import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import asyncForEach from '../../../lib/utils/asyncForEach';
import { Collection, Db, ObjectId } from 'mongodb';

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
  private projectCollection!: Collection;

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.eventsDb.connect(process.env.EVENTS_DB_NAME);
    await this.accountsDb.connect(process.env.ACCOUNTS_DB_NAME);

    this.eventsDbConnection = this.eventsDb.getConnection();
    this.accountDbConnection = this.accountsDb.getConnection();
    this.projectCollection = this.accountDbConnection.collection<{ _id: ObjectId }>('projects');
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
    this.logger.info(`Start archiving at ${new Date()}`);

    const projects = await this.projectCollection.find({}).toArray();

    await asyncForEach(projects, async (project: { _id: ObjectId }) => {
      await this.archiveProjectEvents(project);
    });
    this.logger.info(`Finish archiving at ${new Date()}`);
  }

  /**
   * Removes old events in project
   *
   * @param project - project data to remove events
   */
  private async archiveProjectEvents(project: { _id: ObjectId }): Promise<void> {
    const maxDaysInSeconds = +process.env.MAX_DAYS_NUMBER * 24 * 60 * 60;
    const maxOldTimestamp = (new Date().getTime()) / 1000 - maxDaysInSeconds;

    await this.removeOldDailyEvents(project, maxOldTimestamp);
    const deleteRepetitionsResult = await this.removeOldRepetitions(project, maxOldTimestamp);
    const deleteOriginalEventsResult = await this.removeOriginalEvents(project);
    const deletedCount = deleteOriginalEventsResult + deleteRepetitionsResult;

    await this.updateArchivedEventsCounter(project, deletedCount);

    this.logger.info(`Summary deleted for project ${project._id.toString()}: ${deletedCount}`);
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
}
