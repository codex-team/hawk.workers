import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import asyncForEach from '../../../lib/utils/asyncForEach';
import { Collection, Db, ObjectId } from 'mongodb';

/**
 * Worker for handling Javascript events
 */
export default class GrouperWorker extends Worker {
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
    await super.start();

    this.eventsDbConnection = this.eventsDb.getConnection();
    this.accountDbConnection = this.accountsDb.getConnection();
    this.projectCollection = this.accountDbConnection.collection<{ _id: ObjectId }>('projects');
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
   *
   * @param task - event to handle
   */
  public async handle(task: {}): Promise<void> {
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
    const dailyEventsCollection = this.eventsDbConnection.collection('dailyEvents:' + project._id.toString());
    const maxDaysInSeconds = +process.env.MAX_DAYS_NUMBER * 24 * 60 * 60;
    const maxOldTimestamp = (new Date().getTime()) / 1000 - maxDaysInSeconds;

    await dailyEventsCollection.deleteMany({
      groupingTimestamp: {
        $lt: maxOldTimestamp,
      },
    });

    const repetitionsCollection = this.eventsDbConnection.collection('repetitions:' + project._id.toString());

    const deleteRepetitionsResult = await repetitionsCollection.deleteMany({
      'payload.timestamp': {
        $lt: maxOldTimestamp,
      },
    });
    const deleteOriginalEventsResult = await this.removeOriginalEvents(project);

    const deletedCount = deleteOriginalEventsResult + (deleteRepetitionsResult.deletedCount || 0);

    await this.projectCollection.updateOne({
      _id: project._id,
    },
    {
      $inc: {
        archivedEventsCount: deletedCount,
      },
    });

    this.logger.info(`Summary deleted for project ${project._id.toString()}: ${deletedCount}`);
  }

  /**
   * Removes old original events for project
   *
   * @param project - project for handling
   */
  private async removeOriginalEvents(project: { _id: ObjectId }): Promise<number> {
    const eventsCollection = this.eventsDbConnection.collection('events:' + project._id.toString());

    /**
     * Search for all events and their daily events
     */
    const result = await eventsCollection.aggregate([
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
          from: 'dailyEvents:' + project._id.toString(),
          let: { groupHash: '$groupHash' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$groupHash', '$$groupHash'] },
              },
            },
            { $limit: 1 },
            { $project: { groupHash: 1 } },
          ],
          as: 'dailyEvent',
        },
      },
    ]).toArray();

    const groupHashesToRemove = result.filter(res => !res.dailyEvent.length).map(res => res.groupHash);
    const deleteOriginalEventsResult = await eventsCollection.deleteMany({
      groupHash: {
        $in: groupHashesToRemove,
      },
    });

    return deleteOriginalEventsResult.deletedCount || 0;
  }
}
