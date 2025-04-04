import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import asyncForEach from '../../../lib/utils/asyncForEach';
import { Collection, Db, GridFSBucket, ObjectId, ObjectID } from 'mongodb';
import axios from 'axios';
import { ReleaseFileData, ReleaseRecord, ReportData, ReportDataByProject } from './types';
import * as path from 'path';
import * as dotenv from 'dotenv';
import prettysize from 'prettysize';
import { ProjectDBScheme } from '@hawk.so/types';
import { HOURS_IN_DAY, MINUTES_IN_HOUR, MS_IN_SEC, SECONDS_IN_MINUTE } from '../../../lib/utils/consts';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Worker for handling Javascript events
 */
export default class ArchiverWorker extends Worker {
  /**
   * Worker type
   */
  public readonly type: string = pkg.workerType;

  /**
   * Database Controller for events database
   */
  private eventsDb: DatabaseController = new DatabaseController(process.env.MONGO_EVENTS_DATABASE_URI);

  /**
   * Database Controller for accounts database
   */
  private accountsDb: DatabaseController = new DatabaseController(process.env.MONGO_ACCOUNTS_DATABASE_URI);

  /**
   * Connection to events DB
   */
  private eventsDbConnection!: Db;

  /**
   * Collection with projects
   */
  private projectCollection!: Collection<ProjectDBScheme>;

  /**
   * Collection with Javascript releases
   */
  private releasesCollection: Collection<ReleaseRecord>;

  /**
   * Bucket with js-releases files
   */
  private gridFsBucket: GridFSBucket;

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    this.eventsDbConnection = await this.eventsDb.connect();
    const accountDbConnection = await this.accountsDb.connect();

    this.projectCollection = accountDbConnection.collection<ProjectDBScheme>('projects');
    this.releasesCollection = this.eventsDbConnection.collection('releases');

    this.gridFsBucket = this.eventsDb.createGridFsBucket('releases');
    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    await super.finish();
    await this.eventsDb.close();
    await this.accountsDb.close();
  }

  /**
   * Task handling function
   */
  public async handle(): Promise<void> {
    const dbSizeOnStart = (await this.eventsDbConnection.stats()).dataSize;

    const startDate = new Date();

    this.logger.info(`Start archiving at ${startDate}`);

    const projects = await this.projectCollection.find({}).toArray();
    const projectsData: ReportDataByProject[] = [];

    await asyncForEach(projects, async (project) => {
      const archivedEventsCount = await this.archiveProjectEvents(project);

      const removedReleasesCount = await this.removeOldReleases(project);

      projectsData.push({
        project,
        archivedEventsCount,
        removedReleasesCount,
      });
    });

    const finishDate = new Date();
    const dbSizeOnFinish = (await this.eventsDbConnection.stats()).dataSize;

    await this.sendReport({
      dbSizeOnFinish,
      dbSizeOnStart,
      startDate,
      projectsData,
      finishDate,
    });
    this.logger.info(`Finish archiving at ${finishDate}.`);
    this.logger.info(`Database size on start: ${prettysize(dbSizeOnStart)}, on finish: ${prettysize(dbSizeOnFinish)}, delta: ${prettysize(dbSizeOnStart - dbSizeOnFinish)}`);
  }

  /**
   * Removes old events in project
   * Returns archived events count
   *
   * @param project - project data to remove events
   */
  private async archiveProjectEvents(project: ProjectDBScheme): Promise<number> {
    const maxDaysInSeconds = +process.env.MAX_DAYS_NUMBER * HOURS_IN_DAY * MINUTES_IN_HOUR * SECONDS_IN_MINUTE;

    const maxOldTimestamp = (new Date().getTime()) / MS_IN_SEC - maxDaysInSeconds;

    await this.removeOldDailyEvents(project, maxOldTimestamp);
    const deleteRepetitionsResult = await this.removeOldRepetitions(project, maxOldTimestamp);
    const deleteOriginalEventsResult = await this.removeOriginalEvents(project);
    const deletedCount = deleteOriginalEventsResult + deleteRepetitionsResult;

    await this.updateArchivedEventsCounter(project, deletedCount);

    this.logger.info(`Summary deleted events for project ${project._id.toString()}: ${deletedCount}`);

    return deletedCount;
  }

  /**
   * Updates counter for archived events
   *
   * @param project - project to handle
   * @param project._id - project
   * @param deletedCount - events deleted count for incrementation
   */
  private async updateArchivedEventsCounter(project: { _id: ObjectId }, deletedCount: number): Promise<void> {
    await this.projectCollection.updateOne({
      _id: project._id,
    },
    {
      $inc: {
        archivedEventsCount: deletedCount,
      },
    });
  }

  /**
   * Removes old repetitions
   *
   * @param project - project to handle
   * @param project._id - project
   * @param maxOldTimestamp - max timestamp to do not delete events
   */
  private async removeOldRepetitions(project: { _id: ObjectId }, maxOldTimestamp: number): Promise<number> {
    const repetitionsCollection = this.eventsDbConnection.collection('repetitions:' + project._id.toString());

    const repetitionsBulk = repetitionsCollection.initializeUnorderedBulkOp();

    repetitionsBulk.find({
      'payload.timestamp': {
        $lt: maxOldTimestamp,
      },
    }).delete();
    const deleteRepetitionsResult = await repetitionsBulk.execute();

    return deleteRepetitionsResult.nRemoved || 0;
  }

  /**
   * Removes old daily events
   *
   * @param project - project to handle
   * @param project._id - project
   * @param maxOldTimestamp - max timestamp to do not delete events
   */
  private async removeOldDailyEvents(project: { _id: ObjectId }, maxOldTimestamp: number): Promise<void> {
    const dailyEventsCollection = this.eventsDbConnection.collection('dailyEvents:' + project._id.toString());

    const dailyEventsBulk = dailyEventsCollection.initializeUnorderedBulkOp();

    dailyEventsBulk.find({
      groupingTimestamp: {
        $lt: maxOldTimestamp,
      },
    }).delete();
    await dailyEventsBulk.execute();
  }

  /**
   * Removes old original events for project
   *
   * @param project - project for handling
   * @param project._id - project
   */
  private async removeOriginalEvents(project: { _id: ObjectId }): Promise<number> {
    const eventsCollection = this.eventsDbConnection.collection('events:' + project._id.toString());

    /**
     * Result of the aggregation below
     */
    type AggregationResult = {
      groupHash: string;
      dailyEvent: { groupHash: string }[];
    };

    /**
     * Search for all events and their daily events
     */
    const result = await eventsCollection.aggregate<AggregationResult>([
      /**
       * Get only groupHash field from event
       */
      {
        $project: { groupHash: 1 },
      },
      /**
       * Lookup for daily events with the same groupHashes
       */
      {
        $lookup: {
          /**
           * Collection to join
           */
          from: 'dailyEvents:' + project._id.toString(),

          /**
           * Specifies variables to use in the pipeline field stages
           * Specify groupHash variable
           */
          let: { groupHash: '$groupHash' },

          /**
           * Specifies how to process daily events
           */
          pipeline: [
            /**
             * Get daily events with the same group hash
             */
            {
              $match: {
                $expr: { $eq: ['$groupHash', '$$groupHash'] },
              },
            },

            /**
             * Get only one record
             */
            { $limit: 1 },

            /**
             * Get only groupHash field
             */
            { $project: { groupHash: 1 } },
          ],
          as: 'dailyEvent',
        },
      },
    ]).toArray();

    /**
     * Has events any daily records
     *
     * @param events - event to handle
     */
    const noDailyRecords = (events: AggregationResult): boolean => events.dailyEvent.length === 0;

    const groupHashesToRemove = result.filter(noDailyRecords).map(res => res.groupHash);

    const eventsBulk = eventsCollection.initializeUnorderedBulkOp();

    eventsBulk.find({
      groupHash: {
        $in: groupHashesToRemove,
      },
    }).delete();
    const deleteOriginalEventsResult = await eventsBulk.execute();

    return deleteOriginalEventsResult.nRemoved || 0;
  }

  /**
   * Send report with archived events count to Telegram
   *
   * @param reportData - data for sending report
   */
  private async sendReport(reportData: ReportData): Promise<void> {
    if (!process.env.REPORT_NOTIFY_URL) {
      this.logger.error('Can\'t send report because REPORT_NOTIFY_URL not provided');

      return;
    }

    reportData.projectsData.sort((a, b) => b.archivedEventsCount - a.archivedEventsCount);

    let report = process.env.ENVIRONMENT_NAME ? ` Hawk Archiver (${process.env.ENVIRONMENT_NAME}) 📦️\n` : ' Hawk Archiver 📦️\n';
    let totalArchivedEventsCount = 0;

    reportData.projectsData.forEach(dataByProject => {
      if (dataByProject.archivedEventsCount > 0) {
        report += `\n${dataByProject.archivedEventsCount} events | <b>${encodeURIComponent(dataByProject.project.name)}</b> | <code>${dataByProject.project._id}</code>`;
        totalArchivedEventsCount += dataByProject.archivedEventsCount;
      }
    });

    let releasesReport = '\n\n<b>Releases</b>';

    const archivingTimeInMinutes = (reportData.finishDate.getTime() - reportData.startDate.getTime()) / (MS_IN_SEC * SECONDS_IN_MINUTE);

    let totalRemovedReleasesCount = 0;

    reportData.projectsData.forEach(dataByProject => {
      if (dataByProject.removedReleasesCount > 0) {
        releasesReport += `\n${dataByProject.removedReleasesCount} releases | <b>${encodeURIComponent(dataByProject.project.name)}</b> | <code>${dataByProject.project._id}</code>`;
        totalRemovedReleasesCount += dataByProject.removedReleasesCount;
      }
    });

    if (totalRemovedReleasesCount > 0) {
      report += releasesReport;
    }

    const DIGITS_AFTER_POINT = 3;

    report += `\n\n<b>${totalArchivedEventsCount}</b> events and <b>${totalRemovedReleasesCount}</b> releases archived in ${archivingTimeInMinutes.toFixed(DIGITS_AFTER_POINT)} min`;
    report += `\nDatabase size changed from ${prettysize(reportData.dbSizeOnStart)} to ${prettysize(reportData.dbSizeOnFinish)} (–${prettysize(reportData.dbSizeOnStart - reportData.dbSizeOnFinish)})`;

    await axios({
      method: 'post',
      url: process.env.REPORT_NOTIFY_URL,
      data: 'message=' + report + '&parse_mode=HTML',
    });
  }

  /**
   * Removes old project releases
   *
   * @param project - project to handle
   */
  private async removeOldReleases(project: ProjectDBScheme): Promise<number> {
    const RELEASES_COUNT_TO_STAY = 2;
    const maxDaysInSeconds = +process.env.MAX_DAYS_NUMBER * HOURS_IN_DAY * MINUTES_IN_HOUR * SECONDS_IN_MINUTE;
    /**
     * Create timestamp for one month ago
     */
    const maxOldTimestamp = (new Date().getTime()) / MS_IN_SEC - maxDaysInSeconds;

    /**
     * Create mongo ObjectId for record that was inserted one month ago
     */
    const objectIdThreshold = ObjectID.createFromTime(maxOldTimestamp);

    const releasesToRemove = await this.releasesCollection
      .find({
        projectId: project._id.toString(),
        _id: { $lt: objectIdThreshold },
      })
      .sort({ _id: -1 })
      .skip(RELEASES_COUNT_TO_STAY)
      .toArray();

    const filesToDelete = releasesToRemove.reduce<ReleaseFileData[]>(
      (acc, curr) => acc.concat(curr.files || []), []
    );

    await Promise.all(filesToDelete.map(file => {
      return new Promise<void>((resolve, reject) => {
        this.gridFsBucket.delete(file._id, (err) => {
          if (err) {
            if (err.message.startsWith('FileNotFound')) {
              resolve();

              return;
            }
            reject(err);
          }

          resolve();
        });
      });
    }));

    const releasesIdsToDelete = releasesToRemove.reduce<ObjectId[]>((acc, curr) => {
      acc.push(curr._id);

      return acc;
    }, []);

    const releasesBulk = this.releasesCollection.initializeUnorderedBulkOp();

    releasesBulk.find({
      _id: {
        $in: releasesIdsToDelete,
      },
    }).delete();
    const result = await releasesBulk.execute();

    this.logger.info(`Summary deleted releases for project ${project._id.toString()}: ${result.nRemoved}`);

    return result.nRemoved;
  }
}
