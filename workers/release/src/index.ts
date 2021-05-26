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
import { SourceMapsRecord, ReleaseWorkerTask, ReleaseWorkerAddReleasePayload, CommitDataUnparsed } from '../types';
import { ObjectId } from 'mongodb';
import { SourceMapDataExtended, SourceMapFileChunk, CommitData, SourcemapCollectedData } from 'hawk.types';
/**
 * Java Script releases worker
 */
export default class ReleaseWorker extends Worker {
  /**
   * Worker type (will pull tasks from Registry fqueue with the same name)
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
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.db.connect();
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
   * @param task - Message object from consume method
   */
  public async handle(task: ReleaseWorkerTask): Promise<void> {
    switch (task.type) {
      case 'add-release': await this.saveRelease(task.projectId ,task.payload as ReleaseWorkerAddReleasePayload); break;
    }
  }

  /**
   * Save user's release
   *
   * @param payload - release payload
   */
  private async saveRelease(projectId: string, payload: ReleaseWorkerAddReleasePayload): Promise<void> {
    try {
      const commits = payload.commits;

      if (!this.areCommitsValid(commits)) {
        throw new Error('Commits are not valid');
      }

      const commitsWithParsedDate: CommitData[] = commits.map(commit => ({
        ...commit,
        date: new Date(commit.date)
      }));

      await this.db.getConnection()
        .collection(this.dbCollectionName)
        .updateOne({
          projectId: projectId,
          release: payload.release,
        }, {
          $set: {
            commits: commitsWithParsedDate,
          },
        }, {
          upsert: true,
        });

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

      if (commits.length > 0) {
        return commits.every(commitValidation);
      }

      throw new Error('Release must contains at least one commit');
    } catch (err) {
      throw new Error(`Commtis are not valid: ${err}`);
    }
  }

  /**
   * Extract original file name from source-map's "file" property
   * and extend data-to-save with it
   *
   * @param payload - source map data
   */
  private async saveSourceMap(projectId: string, payload: ReleaseWorkerAddReleasePayload): Promise<void> {
    try {
      const sourceMapsFilesExtended: SourceMapDataExtended[] = this.extendReleaseInfo(payload.files);

      /**
       * Save source map
       */
      await this.saveSourceMapJS({
        projectId: projectId,
        release: payload.release,
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
   * @param releaseData - info with source map
   */
  private async saveSourceMapJS(releaseData: SourceMapsRecord): Promise<ObjectId | null> {
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

        const alreadySaved = existedRelease && existedRelease.files && existedRelease.files.find((savedFile) => {
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
      throw new DatabaseReadWriteError(err);
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
