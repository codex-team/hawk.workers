import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import asyncForEach from '../../../lib/utils/asyncForEach';
import { Collection, Db, ObjectId } from 'mongodb';
import axios from 'axios';
import { Project, ReportDataByProject, ReportData } from './types';

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
  private eventsDb: DatabaseController = new DatabaseController();

  /**
   * Database Controller for accounts database
   */
  private accountsDb: DatabaseController = new DatabaseController();

  /**
   * Connection to events DB
   */
  private eventsDbConnection!: Db;

  /**
   * Connection to accounts DB
   */
  private accountDbConnection!: Db;

  /**
   * Collection with projects
   */
  private projectCollection!: Collection<Project>;

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.eventsDb.connect(process.env.EVENTS_DB_NAME);
    await this.accountsDb.connect(process.env.ACCOUNTS_DB_NAME);

    this.eventsDbConnection = this.eventsDb.getConnection();
    this.accountDbConnection = this.accountsDb.getConnection();
    this.projectCollection = this.accountDbConnection.collection<Project>('projects');
    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    await super.finish();
    await this.eventsDb.close();
  }

  /**
   * Task handling function
   */
  public async handle(): Promise<void> {
    const startDate = new Date();

    this.logger.info(`Start archiving at ${startDate}`);

    const projects = await this.projectCollection.find({}).toArray();
    const projectsData: ReportDataByProject[] = [];

    await asyncForEach(projects, async (project) => {
      const archivedEventsCount = await this.archiveProjectEvents(project);

      projectsData.push({
        project,
        archivedEventsCount,
      });
    });

    const finishDate = new Date();

    await this.sendReport({
      startDate,
      projectsData,
      finishDate,
    });
    this.logger.info(`Finish archiving at ${finishDate}`);
  }

  /**
   * Removes old events in project
   * Returns archived events count
   *
   * @param project - project data to remove events
   */
  private async archiveProjectEvents(project: { _id: ObjectId }): Promise<number> {
    const maxDaysInSeconds = +process.env.MAX_DAYS_NUMBER * 24 * 60 * 60;
    const maxOldTimestamp = (new Date().getTime()) / 1000 - maxDaysInSeconds;

    await this.removeOldDailyEvents(project, maxOldTimestamp);
    const deleteRepetitionsResult = await this.removeOldRepetitions(project, maxOldTimestamp);
    const deleteOriginalEventsResult = await this.removeOriginalEvents(project);
    const deletedCount = deleteOriginalEventsResult + deleteRepetitionsResult;

    await this.updateArchivedEventsCounter(project, deletedCount);

    this.logger.info(`Summary deleted for project ${project._id.toString()}: ${deletedCount}`);

    return deletedCount;
  }

  /**
   * Updates counter for archived events
   *
   * @param project - project to handle
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
   * @param maxOldTimestamp - max timestamp to do not delete events
   */
  private async removeOldRepetitions(project: { _id: ObjectId }, maxOldTimestamp: number): Promise<number> {
    const repetitionsCollection = this.eventsDbConnection.collection('repetitions:' + project._id.toString());
    const deleteRepetitionsResult = await repetitionsCollection.deleteMany({
      'payload.timestamp': {
        $lt: maxOldTimestamp,
      },
    });

    return deleteRepetitionsResult.deletedCount || 0;
  }

  /**
   * Removes old daily events
   *
   * @param project - project to handle
   * @param maxOldTimestamp - max timestamp to do not delete events
   */
  private async removeOldDailyEvents(project: { _id: ObjectId }, maxOldTimestamp: number): Promise<void> {
    const dailyEventsCollection = this.eventsDbConnection.collection('dailyEvents:' + project._id.toString());

    await dailyEventsCollection.deleteMany({
      groupingTimestamp: {
        $lt: maxOldTimestamp,
      },
    });
  }

  /**
   * Removes old original events for project
   *
   * @param project - project for handling
   */
  private async removeOriginalEvents(project: { _id: ObjectId }): Promise<number> {
    const eventsCollection = this.eventsDbConnection.collection('events:' + project._id.toString());

    /**
     * Result of the aggregation below
     */
    type AggregationResult = {
      groupHash: string;
      dailyEvent: { groupHash: string }[];
    }

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
    const deleteOriginalEventsResult = await eventsCollection.deleteMany({
      groupHash: {
        $in: groupHashesToRemove,
      },
    });

    return deleteOriginalEventsResult.deletedCount || 0;
  }

  /**
   * Send report with archived events count to Telegram
   *
   * @param reportData - data for sending report
   */
  private async sendReport(reportData: ReportData): Promise<void> {
    if (!process.env.CODEX_BOT_WEBHOOK) {
      this.logger.error('Can\'t send report because CODEX_BOT_WEBHOOK not provided');

      return;
    }

    let report = 'Hawk Archiver ☣️ \n';
    let totalArchivedEventsCount = 0;

    reportData.projectsData.forEach(dataByProject => {
      if (dataByProject.archivedEventsCount > 0) {
        report += `\n${dataByProject.archivedEventsCount} events | <b>${dataByProject.project.name}</b> | <code>${dataByProject.project._id}</code>`;
        totalArchivedEventsCount += dataByProject.archivedEventsCount;
      }
    });

    const archivingTimeInMinutes = (reportData.finishDate.getTime() - reportData.startDate.getTime()) / (1000 * 60);

    report += `\n\n${totalArchivedEventsCount} total events archived in ${archivingTimeInMinutes.toFixed(3)} min`;

    await axios({
      method: 'post',
      url: process.env.CODEX_BOT_WEBHOOK,
      data: 'message=' + report + '&parse_mode=HTML',
    });
  }
}
