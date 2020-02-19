/**
 * This worker gets source map from the Registry and puts it to Mongo
 * to provide access for it for JS Worker
 */
import {RawSourceMap} from 'hawk-worker-javascript/node_modules/source-map';
import { Readable } from 'stream';
import {DatabaseController} from '../../../lib/db/controller';
import {DatabaseError, NonCriticalError, Worker} from '../../../lib/worker';
import * as pkg from '../package.json';
import {SourcemapCollectedData, SourceMapsEventWorkerTask} from '../types/source-maps-event-worker-task';
import {SourcemapDataExtended, SourceMapFileChunk, SourceMapsRecord} from '../types/source-maps-record';

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
  public async start() {
    await this.db.connect(process.env.EVENTS_DB_NAME);
    this.db.createGridFsBucket(this.dbCollectionName);
    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish() {
    await super.finish();
    await this.db.close();
  }

  /**
   * Message handle function
   *
   * @param {SourceMapsEventWorkerTask} task - Message object from consume method
   */
  public async handle(task: SourceMapsEventWorkerTask) {
    /**
     * Extract original file name from source-map's "file" property
     * and extend data-to-save with it
     */
    try {
      const sourceMapsFilesExtended: SourcemapDataExtended[] = this.extendReleaseInfo(task.files);

      /**
       * Save source map
       */
      const savingResult = await this.save({
        projectId: task.projectId,
        release: task.release,
        files: sourceMapsFilesExtended,
      } as SourceMapsRecord);
      
      console.log('savingResult', savingResult);

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
  private extendReleaseInfo(sourceMaps: SourcemapCollectedData[]): SourcemapDataExtended[] {
    console.log('extendReleaseInfo');
    return sourceMaps.map((file: SourcemapCollectedData) => {
      try {
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
      } catch (error) {
        console.error('Error while extending source map info', error);
        return null;
      }
    });
  }

  /**
   * Save map file to database
   *
   * @param {SourceMapsRecord} releaseData - info with source map
   */
  private async save(releaseData: SourceMapsRecord) {
    console.log('save');
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
      let savedFiles = await Promise.all(releaseData.files.map(async (map: SourcemapDataExtended) => {
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
           * Replace 'content' with saved file id
           */
          map._id = fileInfo._id;
          delete map.content;

          return map;
        } catch ( error ) {
          console.log(`Map ${map.mapFileName} was not saved: `, error);
        }
      }));
      
      console.log('savedFiles', savedFiles);

      /**
       * Filter unsaved maps
       */
      savedFiles = savedFiles.filter( (file) => file !== undefined);

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
            files: savedFiles as SourcemapDataExtended[],
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
              $each: savedFiles as SourcemapDataExtended[],
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
   * @param file - source map file extended
   */
  private saveFile(file: SourcemapDataExtended): Promise<SourceMapFileChunk> {
    return new Promise((resolve, reject) => {
      const readable = Readable.from([file.content]);
      const writeStream = this.db.getBucket().openUploadStream(file.mapFileName);

      readable
        .pipe(writeStream)
        .on('error', (error) => {
          reject(error);
        })
        .on('finish', (info: SourceMapFileChunk) => {
          readable.destroy();
          writeStream.destroy();
          resolve(info);
        });
    });
  }
}
