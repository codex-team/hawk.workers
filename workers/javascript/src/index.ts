import { MappedPosition, SourceMapConsumer } from 'source-map-js';
import { DatabaseController } from '../../../lib/db/controller';
import { EventWorker } from '../../../lib/event-worker';
import { DatabaseReadWriteError } from '../../../lib/workerErrors';
import * as WorkerNames from '../../../lib/workerNames';
import { GroupWorkerTask } from '../../grouper/types/group-worker-task';
import { SourceMapsRecord } from '../../release/types';
import * as pkg from '../package.json';
import { JavaScriptEventWorkerTask } from '../types/javascript-event-worker-task';
import HawkCatcher from '@hawk.so/nodejs';
import Crypto from '../../../lib/utils/crypto';
import { BacktraceFrame, CatcherMessagePayload, CatcherMessageType, ErrorsCatcherType, SourceCodeLine, SourceMapDataExtended } from '@hawk.so/types';
import { beautifyUserAgent } from './utils';
import { Collection } from 'mongodb';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

/**
 * Worker for handling Javascript events
 */
export default class JavascriptEventWorker extends EventWorker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public readonly type: CatcherMessageType = pkg.workerType as CatcherMessageType;

  /**
   * Releases collection in database
   */
  public releasesDbCollection: Collection;

  /**
   * Database Controller
   */
  private db: DatabaseController = new DatabaseController(process.env.MONGO_EVENTS_DATABASE_URI);

  /**
   * Collection where source maps stored
   */
  private releasesDbCollectionName = 'releases';

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.db.connect();
    this.db.createGridFsBucket(this.releasesDbCollectionName);
    this.prepareCache();
    this.releasesDbCollection = this.db.getConnection().collection(this.releasesDbCollectionName);
    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    await super.finish();
    this.clearCache();
    await this.db.close();
  }

  /**
   * Message handle function
   *
   * @param event - event to handle
   */
  public async handle(event: JavaScriptEventWorkerTask): Promise<void> {
    if (event.payload.release && event.payload.backtrace) {
      this.logger.info('beautifyBacktrace called');

      try {
        event.payload.backtrace = await this.beautifyBacktrace(event);
      } catch (err) {
        this.logger.error('Error while beautifing backtrace', err);
      }
    }

    if (event.payload.addons?.userAgent) {
      event.payload.addons.beautifiedUserAgent = beautifyUserAgent(event.payload.addons.userAgent.toString());
    }

    await this.addTask(WorkerNames.GROUPER, {
      projectId: event.projectId,
      catcherType: this.type as CatcherMessageType,
      payload: event.payload as CatcherMessagePayload<CatcherMessageType>,
      timestamp: event.timestamp,
    } as GroupWorkerTask<ErrorsCatcherType>);
  }

  /**
   * This method tries to find a source map for passed release
   * and overrides a backtrace with parsed source-map
   *
   * @param {JavaScriptEventWorkerTask} event — js error minified
   * @returns {BacktraceFrame[]} - parsed backtrace
   */
  private async beautifyBacktrace(event: JavaScriptEventWorkerTask): Promise<BacktraceFrame[]> {
    const releaseRecord: SourceMapsRecord = await this.cache.get(
      `releaseRecord:${event.projectId}:${event.payload.release.toString()}`,
      () => {
        return this.getReleaseRecord(
          event.projectId,
          event.payload.release.toString()
        );
      }
    );

    if (!releaseRecord) {
      this.logger.info('beautifyBacktrace: no releaseRecord found');

      return event.payload.backtrace;
    }

    this.logger.info(`beautifyBacktrace: release record found: ${JSON.stringify(releaseRecord)}`);

    /**
     * If we have a source map associated with passed release, override some values in backtrace with original line/file
     */
    return Promise.all(event.payload.backtrace.map(async (frame: BacktraceFrame, index: number) => {
      /**
       * Get cached (or set if the value is missing) real backtrace frame
       */
      const result = await this.cache.get(
        `consumeBacktraceFrame:${event.payload.release.toString()}:${Crypto.hash(frame)}:${index}`,
        () => {
          return this.consumeBacktraceFrame(frame, releaseRecord)
            .catch((error) => {
              this.logger.error('Error while consuming ' + error.stack);

              /**
               * Send error to Hawk
               */
              HawkCatcher.send(error, {
                payload: event.payload as unknown as Record<string, never>,
              });

              return event.payload.backtrace[index];
            });
        }
      );

      return result;
    }));
  }

  /**
   * Try to parse backtrace item with source map
   *
   * @param {BacktraceFrame} stackFrame — one line of stack
   * @param {SourceMapsRecord} releaseRecord — what we store in DB (map file name, origin file name, maps files)
   */
  private async consumeBacktraceFrame(stackFrame: BacktraceFrame,
    releaseRecord: SourceMapsRecord): Promise<BacktraceFrame> {
    /**
     * Sometimes catcher can't extract file from the backtrace
     */
    if (!stackFrame.file) {
      this.logger.info(`consumeBacktraceFrame: No stack frame file found`);

      return stackFrame;
    }

    /**
     * One releaseRecord can contain several source maps for different chunks,
     * so find a map for current stack-frame file
     */
    const mapForFrame: SourceMapDataExtended = releaseRecord.files.find((mapFileName: SourceMapDataExtended) => {
      /**
       * File name with full path from stack frame
       * For example, 'file:///main.js' or 'file:///codex.so/static/js/main.js'
       */
      const fullPathFileName = stackFrame.file;

      /**
       * Origin file name from source map
       * For example, 'main.js' or 'static/js/main.js'
       */
      const originFileName = mapFileName.originFileName;

      return fullPathFileName.includes(originFileName);
    });

    if (!mapForFrame) {
      this.logger.info(`consumeBacktraceFrame: No map file found for the frame: ${JSON.stringify(stackFrame)}`);

      return stackFrame;
    }

    /**
     * Load source map content from Grid fs
     */
    const mapContent = await this.loadSourceMapFile(mapForFrame);

    if (!mapContent) {
      this.logger.info(`consumeBacktraceFrame: Can't load map content for ${JSON.stringify(mapForFrame)}`);

      return stackFrame;
    }

    /**
     * @todo cache source map consumer for file-keys
     */
    const consumer = this.consumeSourceMap(mapContent);

    /**
     * Error's original position
     */
    const originalLocation: MappedPosition = consumer.originalPositionFor({
      line: stackFrame.line,
      column: stackFrame.column,
      /**
       * Helps to get exact position if column is not accurate enough
       */
      bias: SourceMapConsumer.LEAST_UPPER_BOUND,
    });

    /**
     * Source code lines
     */
    let lines = [];

    let functionContext = originalLocation.name;

    /**
     * Get source code lines above and below event line
     * If source file path is missing then skip source lines reading
     *
     * Fixes bug: https://github.com/codex-team/hawk.workers/issues/121
     */
    if (originalLocation.source) {
      /**
       * Get 5 lines above and 5 below
       */
      lines = this.readSourceLines(consumer, originalLocation);

      const originalContent = consumer.sourceContentFor(originalLocation.source);

      functionContext = this.getFunctionContext(originalContent, originalLocation.line) ?? originalLocation.name;
    }

    return Object.assign(stackFrame, {
      line: originalLocation.line,
      column: originalLocation.column,
      file: originalLocation.source,
      function: functionContext,
      sourceCode: lines,
    }) as BacktraceFrame;
  }

  /**
   * Method that is used to parse full function context of the code position
   *
   * @param sourceCode - content of the source file
   * @param line - number of the line from the stack trace
   * @returns - string of the function context or null if it could not be parsed
   */
  private getFunctionContext(sourceCode: string, line: number): string | null {
    let functionName: string | null = null;
    let className: string | null = null;
    let isAsync = false;

    try {
      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'jsx',
          'classProperties',
          'decorators',
          'optionalChaining',
          'nullishCoalescingOperator',
          'dynamicImport',
          'bigInt',
          'topLevelAwait',
        ],
      });

      traverse(ast as any, {
        /**
         * It is used to get class decorator of the position, it will save class that is related to original position
         *
         * @param path
         */
        ClassDeclaration(path) {
          console.log(`class declaration: loc: ${path.node.loc}, line: ${line}, node.start.line: ${path.node.loc.start.line}, node.end.line: ${path.node.loc.end.line}`);

          if (path.node.loc && path.node.loc.start.line <= line && path.node.loc.end.line >= line) {
            className = path.node.id.name || null;
          }
        },
        /**
         * It is used to get class and its method decorator of the position
         * It will save class and method, that are related to original position
         *
         * @param path
         */
        ClassMethod(path) {
          console.log(`class declaration: loc: ${path.node.loc}, line: ${line}, node.start.line: ${path.node.loc.start.line}, node.end.line: ${path.node.loc.end.line}`);

          if (path.node.loc && path.node.loc.start.line <= line && path.node.loc.end.line >= line) {
            // Handle different key types
            if (path.node.key.type === 'Identifier') {
              functionName = path.node.key.name;
            }
            isAsync = path.node.async;
          }
        },
        /**
         * It is used to get function name that is declared out of class
         *
         * @param path
         */
        FunctionDeclaration(path) {
          console.log(`function declaration: loc: ${path.node.loc}, line: ${line}, node.start.line: ${path.node.loc.start.line}, node.end.line: ${path.node.loc.end.line}`);

          if (path.node.loc && path.node.loc.start.line <= line && path.node.loc.end.line >= line) {
            functionName = path.node.id.name || null;
            isAsync = path.node.async;
          }
        },
        /**
         * It is used to get anonimous function names in function expressions or arrow function expressions
         *
         * @param path
         */
        VariableDeclarator(path) {
          console.log(`variable declaration: node.type: ${path.node.init.type}, line: ${line}, `);

          if (
            path.node.init &&
            (path.node.init.type === 'FunctionExpression' || path.node.init.type === 'ArrowFunctionExpression') &&
            path.node.loc &&
            path.node.loc.start.line <= line &&
            path.node.loc.end.line >= line
          ) {
            // Handle different id types
            if (path.node.id.type === 'Identifier') {
              functionName = path.node.id.name;
            }
            isAsync = (path.node.init as any).async;
          }
        },
      });
    } catch (e) {
      console.error(`Failed to parse source code: ${e.message}`);
    }

    return functionName ? `${isAsync ? 'async ' : ''}${className ? `${className}.` : ''}${functionName}` : null;
  }

  /**
   * Downloads source map file from Grid FS
   *
   * @param map - saved file info without content.
   */
  private loadSourceMapFile(map: SourceMapDataExtended): Promise<string> {
    return new Promise((resolve, reject) => {
      let buf = Buffer.from('');

      const readstream = this.db.getBucket().openDownloadStream(map._id)
        .on('data', (chunk) => {
          buf = Buffer.concat([buf, chunk]);
        })
        .on('error', (error) => {
          reject(error);
        })
        .on('end', () => {
          const res = buf.toString();

          /**
           * Clean up memory
           */
          buf = null;
          readstream.destroy();
          resolve(res);
        });
    });
  }

  /**
   * Reads near-placed lines from the original source
   *
   * @param {SourceMapConsumer} consumer - consumer for course maps
   * @param {MappedPosition} original - source file's line,column,source etc
   * @returns {SourceCodeLine[]}
   */
  private readSourceLines(
    consumer: SourceMapConsumer,
    original: MappedPosition
  ): SourceCodeLine[] {
    const sourceContent = consumer.sourceContentFor(original.source, true);

    if (!sourceContent) {
      return null;
    }

    const margin = 5;
    const lines = sourceContent.split(/(?:\r\n|\r|\n)/g);
    const focusedLines = lines.slice(original.line - margin - 1, original.line + margin);

    return focusedLines.map((line, idx) => {
      return {
        line: Math.max(original.line - margin + idx, 1),
        content: line,
      } as SourceCodeLine;
    });
  }

  /**
   * Return source map for passed release from DB
   * Source Map are delivered at the building-time from client's server to the Source Maps Worker
   *
   * @param {string} projectId - event's project id
   * @param {string} release - bundle version passed with source map and same release passed to the catcher's init
   */
  private async getReleaseRecord(projectId: string, release: string): Promise<SourceMapsRecord> {
    try {
      const releaseRecord = await this.releasesDbCollection
        .findOne({
          projectId,
          release,
        }, {
          sort: {
            _id: -1,
          },
        });

      this.logger.info(`Got release record: \n${JSON.stringify(releaseRecord)}`);

      return releaseRecord;
    } catch (err) {
      this.logger.error('Error while getting release record', err);
      throw new DatabaseReadWriteError(err);
    }
  }

  /**
   * Promise style decorator around source-map consuming method.
   * Source Map Consumer is an object allowed to extract original position by line and col
   *
   * @param {string} mapBody - source map content
   */
  private consumeSourceMap(mapBody: string): SourceMapConsumer {
    try {
      const rawSourceMap = JSON.parse(mapBody);

      return new SourceMapConsumer(rawSourceMap);
    } catch (e) {
      this.logger.error(`Error on source-map consumer initialization: ${e}`);
    }
  }
}
