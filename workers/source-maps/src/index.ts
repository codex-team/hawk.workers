/**
 * This worker gets source map from the Registry and puts it to Mongo
 * to provide access for it for JS Worker
 */
import { RawSourceMap } from 'hawk-worker-javascript/node_modules/source-map';
import { Readable } from 'stream';
import { DatabaseController } from '../../../lib/db/controller';
import {  Worker } from '../../../lib/worker';
import { NonCriticalError } from '../../../lib/workerErrors';
import * as pkg from '../package.json';
import { SourcemapCollectedData, SourceMapsEventWorkerTask } from '../types/source-maps-event-worker-task';
import { SourceMapDataExtended, SourceMapFileChunk, SourceMapsRecord } from '../types/source-maps-record';
import { ObjectId } from 'mongodb';

/**
 * Java Script source maps worker
 */
export default class SourceMapsWorker extends Worker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public readonly type: string = pkg.workerType;

  /**
   * Database Controller
   */
  private db: DatabaseController = new DatabaseController();

  /**
   * Source maps will stored in this collection
   * One for all projects
   */
  private readonly dbCollectionName: string = 'releases-js';

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.db.connect(process.env.EVENTS_DB_NAME);
    this.db.createGridFsBucket(this.dbCollectionName);
    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    await super.finish();
    await this.db.close();
  }

  /**
   * Message handle function
   *
   * @param {SourceMapsEventWorkerTask} task - Message object from consume method
   */
  public async handle(task: SourceMapsEventWorkerTask): Promise<void> {
    /**
     * Extract original file name from source-map's "file" property
     * and extend data-to-save with it
     */
    try {
      const sourceMapsFilesExtended: SourceMapDataExtended[] = this.extendReleaseInfo(task.files);

      /**
       * Save source map
       */
      await this.save({
        projectId: task.projectId,
        release: task.release,
        files: sourceMapsFilesExtended,
      } as SourceMapsRecord);
    } catch (error) {
      this.logger.error('Can\'t extract release info:\n', {
        error,
      });

      throw new NonCriticalError('Can\'t parse source-map file');
    }
  }

  /**
   * Extract original file name from source-map's "file" property
   * and extend data-to-save with it
   *
   * @param {SourcemapCollectedData[]} sourceMaps — source maps passed from user after bundle
   */
  private extendReleaseInfo(sourceMaps: SourcemapCollectedData[]): SourceMapDataExtended[] {
    return sourceMaps.map((file: SourcemapCollectedData) => {
      /**
       * Decode base64 source map content
       */
      const buffer = Buffer.from(file.payload, 'base64');
      const mapBodyString = buffer.toString();
      /**
       * @todo use more efficient method to extract "file" from big JSON
       */
      const mapContent = JSON.parse(mapBodyString) as RawSourceMap;

      return {
        mapFileName: file.name,
        originFileName: mapContent.file,
        content: mapBodyString,
      };
    });
  }

  /**
   * Save map file to database
   *
   * @param {SourceMapsRecord} releaseData - info with source map
   */
  private async save(releaseData: SourceMapsRecord): Promise<ObjectId | null> {
    try {
      const existedRelease = await this.db.getConnection()
        .collection(this.dbCollectionName)
        .findOne({
          projectId: releaseData.projectId,
          release: releaseData.release,
        });

      /**
       * Iterate all maps of the new release and save only new
       */
      let savedFiles = await Promise.all(releaseData.files.map(async (map: SourceMapDataExtended) => {
        /**
         * Skip already saved maps
         */
        const alreadySaved = existedRelease && existedRelease.files.find((savedFile) => {
          return savedFile.mapFileName === map.mapFileName;
        });

        if (alreadySaved) {
          return;
        }

        try {
          const fileInfo = await this.saveFile(map);

          /**
           * Remove 'content' and save id of saved file instead
           */
          map._id = fileInfo._id;
          delete map.content;

          return map;
        } catch (error) {
          console.log(`Map ${map.mapFileName} was not saved: `, error);
        }
      }));

      /**
       * Filter unsaved maps
       */
      savedFiles = savedFiles.filter((file) => file !== undefined);

      /**
       * Nothing to save: maps was previously saved
       */
      if (!savedFiles) {
        return;
      }

      /**
       * - insert new record with saved maps
       * or
       * - update previous record with adding new saved maps
       */
      if (!existedRelease) {
        const insertion = await this.db.getConnection()
          .collection(this.dbCollectionName)
          .insertOne({
            projectId: releaseData.projectId,
            release: releaseData.release,
            files: savedFiles as SourceMapDataExtended[],
          });

        return insertion ? insertion.insertedId : null;
      }

      const updating = await this.db.getConnection()
        .collection(this.dbCollectionName)
        .findOneAndUpdate({
          projectId: releaseData.projectId,
          release: releaseData.release,
        }, {
          $push: {
            files: {
              $each: savedFiles as SourceMapDataExtended[],
            },
          },
        });

      return updating ? updating.value._id : null;
    } catch (err) {
      this.logger.error('DatabaseError:', err);
    }
  }

  /**
   * Saves source map file to the GridFS
   *
   * @param file - source map file extended
   */
  private saveFile(file: SourceMapDataExtended): Promise<SourceMapFileChunk> {
    return new Promise((resolve, reject) => {
      const readable = Readable.from([ file.content ]);
      const writeStream = this.db.getBucket().openUploadStream(file.mapFileName);

      readable
        .pipe(writeStream)
        .on('error', (error) => {
          reject(error);
        })
        .on('finish', (info: SourceMapFileChunk) => {
          readable.destroy();
          resolve(info);
        });
    });
  }
}
