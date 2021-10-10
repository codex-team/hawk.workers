import { BasicSourceMapConsumer, IndexedSourceMapConsumer, NullableMappedPosition, SourceMapConsumer } from 'source-map';
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
import { rightTrim } from '../../../lib/utils/string';
import { BacktraceFrame, SourceCodeLine, SourceMapDataExtended } from '@hawk.so/types';
import { beautifyUserAgent } from './utils';
import { Collection } from 'mongodb';

/**
 * Worker for handling Javascript events
 */
export default class JavascriptEventWorker extends EventWorker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public readonly type: string = pkg.workerType;

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
      event.payload.backtrace = await this.beautifyBacktrace(event);
    }

    if (event.payload.addons?.userAgent) {
      event.payload.addons.beautifiedUserAgent = beautifyUserAgent(event.payload.addons.userAgent.toString());
    }

    await this.addTask(WorkerNames.GROUPER, {
      projectId: event.projectId,
      catcherType: this.type,
      event: event.payload,
    } as GroupWorkerTask);
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
      return event.payload.backtrace;
    }

    /**
     * If we have a source map associated with passed release, override some values in backtrace with original line/file
     */
    return Promise.all(event.payload.backtrace.map(async (frame: BacktraceFrame, index: number) => {
      /**
       * Get cached (or set if the value is missing) real backtrace frame
       */
      return this.cache.get(
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
      return stackFrame;
    }

    /**
     * One releaseRecord can contain several source maps for different chunks,
     * so find a map by for current stack-frame file
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
      return stackFrame;
    }

    /**
     * Load source map content from Grid fs
     */
    const mapContent = await this.loadSourceMapFile(mapForFrame);

    if (!mapContent) {
      return stackFrame;
    }

    /**
     * @todo cache source map consumer for file-keys
     */
    let consumer = await this.consumeSourceMap(mapContent);

    /**
     * Error's original position
     */
    const originalLocation: NullableMappedPosition = consumer.originalPositionFor({
      line: stackFrame.line,
      column: stackFrame.column,
    });

    /**
     * Source code lines
     */
    let lines = [];

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
    }

    consumer.destroy();
    consumer = null;

    return Object.assign(stackFrame, {
      line: originalLocation.line,
      column: originalLocation.column,
      file: originalLocation.source,
      sourceCode: lines,
    }) as BacktraceFrame;
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
   * @param {BasicSourceMapConsumer | IndexedSourceMapConsumer} consumer - consumer for course maps
   * @param {NullableMappedPosition} original - source file's line,column,source etc
   * @returns {SourceCodeLine[]}
   */
  private readSourceLines(
    consumer: BasicSourceMapConsumer | IndexedSourceMapConsumer,
    original: NullableMappedPosition
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
        content: rightTrim(line),
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
      return await this.releasesDbCollection
        .findOne({
          projectId,
          release,
        }, {
          sort: {
            _id: -1,
          },
        });
    } catch (err) {
      throw new DatabaseReadWriteError(err);
    }
  }

  /**
   * Promise style decorator around source-map consuming method.
   * Source Map Consumer is an object allowed to extract original position by line and col
   *
   * @param {string} mapBody - source map content
   */
  private async consumeSourceMap(mapBody: string): Promise<BasicSourceMapConsumer | IndexedSourceMapConsumer> {
    return new Promise((resolve) => {
      SourceMapConsumer.with(mapBody, null, (consumer) => {
        resolve(consumer);
      });
    });
  }
}
