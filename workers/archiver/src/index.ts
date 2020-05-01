import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import asyncForEach from '../../../lib/utils/asyncForEach';

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
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.eventsDb.connect(process.env.EVENTS_DB_NAME);
    await this.accountsDb.connect(process.env.ACCOUNTS_DB_NAME);
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
   *
   * @param task - event to handle
   */
  public async handle(task: {}): Promise<void> {
    this.logger.info(`Start archiving at ${new Date()}`);

    const eventsDbConnection = this.eventsDb.getConnection();
    const accountDbConnection = this.accountsDb.getConnection();
    const projectCollection = accountDbConnection.collection('projects');
    const projects = await projectCollection.find({}).toArray();

    await asyncForEach(projects, async (project) => {
      const dailyEventsCollection = eventsDbConnection.collection('dailyEvents:' + project._id.toString());
      const daysAgo = (new Date().getTime()) / 1000 - 30 * 24 * 60 * 60;

      await dailyEventsCollection.deleteMany({
        groupingTimestamp: {
          $lt: daysAgo,
        },
      });

      const repetitionsCollection = eventsDbConnection.collection('repetitions:' + project._id.toString());

      const deleteRepetitionsResult = await repetitionsCollection.deleteMany({
        'payload.timestamp': {
          $lt: daysAgo,
        },
      });

      const eventsCollection = eventsDbConnection.collection('events:' + project._id.toString());
      const result = await eventsCollection.aggregate([
        {
          $project: { groupHash: 1 },
        },
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

      const deleteOriginalEventsResult = await eventsCollection.deleteMany({
        groupHash: {
          $in: result.filter(res => !res.dailyEvent.length).map(res => res.groupHash),
        },
      });

      this.logger.info(`Summary deleted for project ${project._id.toString()}: ${deleteOriginalEventsResult.deletedCount + deleteRepetitionsResult.deletedCount}`);
    });
    this.logger.info(`Finish archiving at ${new Date()}`);
  }
}
