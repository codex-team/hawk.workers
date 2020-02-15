/**
 * This worker gets source map from the Registry and puts it to Mongo
 * to provide access for it for JS Worker
 */
import {RawSourceMap} from 'hawk-worker-javascript/node_modules/source-map';
import {DatabaseController} from '../../../lib/db/controller';
import {DatabaseError, NonCriticalError, Worker} from '../../../lib/worker';
import * as pkg from '../package.json';
import {SourcemapCollectedData, SourceMapsEventWorkerTask} from '../types/source-maps-event-worker-task';
import {SourcemapDataExtended, SourceMapsRecord} from '../types/source-maps-record';

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
      this.save({
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
  private extendReleaseInfo(sourceMaps: SourcemapCollectedData[]): SourcemapDataExtended[] {
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
  private async save(releaseData: SourceMapsRecord) {
    try {
      const upsertedRelease = await this.db.getConnection()
        .collection(this.dbCollectionName)
        .findOneAndUpdate({
          projectId: releaseData.projectId,
          release: releaseData.release,
        }, {
          $set: {
            projectId: releaseData.projectId,
            release: releaseData.release,
          },
          $push: {
            files: {
              $each: releaseData.files,
            },
          },
        }, {
          upsert: true,
        });

      console.log('upsertedRelease', upsertedRelease);

      return upsertedRelease ? upsertedRelease : null;


    } catch (err) {
      console.log('DatabaseError:', err);
      throw new DatabaseError(err);
    }
  }
}
