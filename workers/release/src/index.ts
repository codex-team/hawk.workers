/**
 * This worker gets source map from the Registry and puts it to Mongo
 * to provide access for it for JS Worker
 */
import { RawSourceMap } from 'source-map';
import { Readable } from 'stream';
import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import { DatabaseReadWriteError, NonCriticalError } from '../../../lib/workerErrors';
import * as pkg from '../package.json';
import { ReleaseWorkerTask, ReleaseWorkerAddReleasePayload, CommitDataUnparsed } from '../types';
import { Collection, MongoClient } from 'mongodb';
import { SourceMapDataExtended, SourceMapFileChunk, CommitData, SourcemapCollectedData, ReleaseDBScheme } from '@hawk.so/types';
/**
 * Worker to save releases
 */
export default class ReleaseWorker extends Worker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public readonly type: string = pkg.workerType;

  /**
   * Database Controller
   */
  private db: DatabaseController = new DatabaseController(process.env.MONGO_EVENTS_DATABASE_URI);

  /**
   * Source maps will stored in this collection
   * One for all projects
   */
  private readonly dbCollectionName: string = 'releases';

  /**
   * Collection to save releases
   */
  private releasesCollection: Collection<ReleaseDBScheme>;

  /**
   * Mongo client for events database, used for transactions
   */
  private client: MongoClient = new MongoClient(process.env.MONGO_EVENTS_DATABASE_URI);

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.client.connect();
    await this.db.connect();
    this.db.createGridFsBucket(this.dbCollectionName);
    this.releasesCollection = this.db.getConnection().collection(this.dbCollectionName);
    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    await super.finish();
    await this.db.close();
    await this.client.close();
  }

  /**
   * Message handle function
   *
   * @param task - Message object from consume method
   */
  public async handle(task: ReleaseWorkerTask): Promise<void> {
    switch (task.type) {
      case 'add-release': await this.saveRelease(task.projectId, task.payload as ReleaseWorkerAddReleasePayload); break;
    }
  }

  /**
   * Save user's release
   *
   * @param projectId - project id to bind the corresponding release.
   * @param payload - release payload
   */
  private async saveRelease(projectId: string, payload: ReleaseWorkerAddReleasePayload): Promise<void> {
    this.logger.info(`saveRelease: save release for project: ${projectId}, release: ${payload.release}`);
    try {
      const commits = payload.commits;

      /**
       * Save commits
       */
      if (commits && this.areCommitsValid(commits)) {
        const commitsWithParsedDate: CommitData[] = commits.map(commit => ({
          ...commit,
          date: new Date(commit.date),
        }));

        await this.releasesCollection.updateOne({
          projectId: projectId,
          release: payload.release,
        }, {
          $set: {
            commits: commitsWithParsedDate,
          },
        }, {
          upsert: true,
        });
      }

      // save source maps
      if (payload.files) {
        await this.saveSourceMap(projectId, payload);
      }
    } catch (err) {
      this.logger.error(`Couldn't save the release due to: ${err}`);

      throw new DatabaseReadWriteError(err);
    }
  }

  /**
   * Check commtis for the content of all required data
   *
   * @param commits - stringified commits
   */
  private areCommitsValid(commits: CommitDataUnparsed[]): boolean {
    try {
      const commitValidation = (commit: CommitDataUnparsed): boolean => {
        const date = Date.parse(commit.date);

        return 'hash' in commit && 'author' in commit && !isNaN(date) && 'title' in commit;
      };

      return commits.every(commitValidation);
    } catch (err) {
      throw new Error(`Commtis are not valid: ${err}`);
    }
  }

  /**
   * Extract original file name from source-map's "file" property
   * and extend data-to-save with it
   *
   * @param projectId - project id in hawk
   * @param payload - source map data
   */
  private async saveSourceMap(projectId: string, payload: ReleaseWorkerAddReleasePayload): Promise<void> {
    /**
     * Start transaction to avoid race condition
     */
    const session = await this.client.startSession();

    try {
      const files: SourceMapDataExtended[] = this.extendReleaseInfo(payload.files);

      /**
       * Use same transaction for read and related write operations
       */
      await session.withTransaction(async () => {
        const existedRelease = await this.releasesCollection.findOne({
          projectId: projectId,
          release: payload.release,
        }, { session });

        /**
         * Iterate all maps of the new release and save only new
         */
        let savedFiles = await Promise.all(files.map(async (map: SourceMapDataExtended) => {
          /**
           * Skip already saved maps
           */

          const alreadySaved = existedRelease && existedRelease.files && existedRelease.files.find((savedFile) => {
            return savedFile.mapFileName === map.mapFileName;
          });

          if (alreadySaved) {
            return;
          }

          try {
            const fileInfo = await this.saveFile(map);

            /**
             * Save id of saved file instead
             */
            map._id = fileInfo._id;

            return map;
          } catch (error) {
            this.logger.error(`Map ${map.mapFileName} was not saved: ${error}`);
          }
        }));

        /**
         * Delete file content after it is saved to the GridFS
         */
        savedFiles.forEach(file => {
          delete file.content;
        })

        /**
         * Filter unsaved maps
         */
        savedFiles = savedFiles.filter((file) => file !== undefined);

        /**
         * Nothing to save: maps was previously saved
         */
        if (savedFiles.length === 0) {
          return;
        }

        /**
         * - insert new record with saved maps
         * or
         * - update previous record with adding new saved maps
         */
        if (!existedRelease) {
          this.logger.info('inserted new release');
          await this.releasesCollection.insertOne({
            projectId: projectId,
            release: payload.release,
            files: savedFiles as SourceMapDataExtended[],
          } as ReleaseDBScheme, { session });
        }

        await this.releasesCollection.findOneAndUpdate({
          projectId: projectId,
          release: payload.release,
        }, {
          $push: {
            files: {
              $each: savedFiles as SourceMapDataExtended[],
            },
          },
        }, { session });
      });
    } catch (error) {
      this.logger.error('Can\'t extract release info:\n', {
        error,
      });

      throw new NonCriticalError('Can\'t parse source-map file');
    } finally {
      /**
       * End transaction
       */
      await session.endSession();
    }
  }

  /**
   * Extract original file name from source-map's "file" property
   * and extend data-to-save with it
   *
   * @param {SourcemapCollectedData[]} sourceMaps — source maps passed from user after bundle
   */
  private extendReleaseInfo(sourceMaps: SourcemapCollectedData[]): SourceMapDataExtended[] {
    return sourceMaps.flatMap((file: SourcemapCollectedData) => {
      /**
       * Decode base64 source map content
       */
      const buffer = Buffer.from(file.payload, 'base64');
      const mapBodyString = buffer.toString();

      /**
       * If content is empty, return nothing for this file
       */
      if (!mapBodyString || mapBodyString.trim().length === 0) {
        return [];
      }

      /**
       * @todo use more efficient method to extract "file" from big JSON
       */
      const mapContent = JSON.parse(mapBodyString) as RawSourceMap;

      return [ {
        mapFileName: file.name,
        originFileName: mapContent.file,
        content: mapBodyString,
      } ];
    });
  }

  /**
   * Saves source map file to the GridFS
   *
   * @param file - source map file extended
   */
  private saveFile(file: SourceMapDataExtended): Promise<SourceMapFileChunk> {
    return new Promise((resolve, reject) => {
      if (!file.content) {
        return reject(new Error('Source map content is empty'));
      }

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
