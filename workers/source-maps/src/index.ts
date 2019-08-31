/**
 * This worker gets source map from the Registry and puts it to Mongo
 * to provide access for it for JS Worker
 */
import {DatabaseError, Worker} from '../../../lib/worker';
import {DatabaseController} from '../../../lib/db/controller';
import {SourcemapCollectedData, SourceMapsEventWorkerTask} from '../types/source-maps-event-worker-task';
import * as pkg from '../package.json'
import {SourcemapDataExtended, SourceMapsRecord} from '../types/source-maps-record';
import {RawSourceMap} from "hawk-worker-javascript/node_modules/source-map";

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
  async start() {
    await this.db.connect();
    await super.start();
  }

  /**
   * Finish everything
   */
  async finish() {
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
    const sourceMapsFilesExtended: SourcemapDataExtended[] = task.files.map((file: SourcemapCollectedData) => {
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
        content: mapBodyString
      }
    });

    /**
     * Save source map
     */
    this.save({
      projectId: task.projectId,
      release: task.release,
      files: sourceMapsFilesExtended
    } as SourceMapsRecord);
  }

  /**
   * Save map file to database
   *
   * @param {SourceMapsRecord} releaseData - info with source map
   */
  async save(releaseData: SourceMapsRecord) {
    try {
      const upsertedRelease = await this.db.getConnection()
        .collection(this.dbCollectionName)
        .replaceOne({
          projectId: releaseData.projectId,
          release: releaseData.release
        }, releaseData, {
          upsert: true
        });

      return upsertedRelease ? upsertedRelease.upsertedId: null;
    } catch (err) {
      console.log('DatabaseError:', err);
      throw new DatabaseError(err);
    }
  }
};
