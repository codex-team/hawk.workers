import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import asyncForEach from '../../../lib/utils/asyncForEach';
import { Collection, Db } from 'mongodb';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { PlanDBScheme, ProjectDBScheme, WorkspaceDBScheme } from 'hawk.types';
import redis from 'redis';

type WorkspaceWithTariffPlan = WorkspaceDBScheme & {tariffPlan: PlanDBScheme}

dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 *
 */
export default class LimiterWorker extends Worker {
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
  private projectsCollection!: Collection<ProjectDBScheme>;

  /**
   * Collection with workspaces
   */
  private workspacesCollection!: Collection<WorkspaceDBScheme>;

  private readonly redisClient = redis.createClient({ url: process.env.REDIS_URL });

  private readonly redisDisabledProjectsKey = 'DisabledProjectsSet'

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    this.eventsDbConnection = await this.eventsDb.connect();
    const accountDbConnection = await this.accountsDb.connect();

    this.projectsCollection = accountDbConnection.collection<ProjectDBScheme>('projects');
    this.workspacesCollection = accountDbConnection.collection<WorkspaceDBScheme>('workspaces');
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
    const [projects, workspaces] = await Promise.all([
      this.projectsCollection.find({}).toArray(),
      this.workspacesCollection.aggregate<WorkspaceWithTariffPlan>([
        {
          $lookup: {
            from: 'plans',
            localField: 'tariffPlanId',
            foreignField: '_id',
            as: 'tariffPlan',
          },
        }, {
          $unwind: {
            path: '$tariffPlan',
          },
        },
      ]).toArray(),
    ]);
    const workspacesMap = workspaces.reduce((acc, workspace) => {
      acc[workspace._id.toString()] = workspace;

      return acc;
    }, {} as Record<string, WorkspaceWithTariffPlan>);

    const workspaceEventsCount: Record<string, number> = {};

    await asyncForEach(projects, async (project) => {
      this.logger.info('Processing project with id ' + project._id);
      const workspace = workspacesMap[project.workspaceId.toString()];

      if (!workspace.lastChargeDate) {
        return;
      }

      const repetitionsCollection = this.eventsDbConnection.collection('repetitions:' + project._id);
      const eventsCollection = this.eventsDbConnection.collection('events:' + project._id);

      const query = {
        'payload.timestamp': {
          $gt: Math.floor(new Date(workspace.lastChargeDate).getTime() / 1000),
        },
      };

      const [repetitionsCount, originalEventCount] = await Promise.all([repetitionsCollection.find(query).count(), eventsCollection.find(query).count()]);

      workspaceEventsCount[project.workspaceId.toString()] = (workspaceEventsCount[project.workspaceId.toString()] || 0) + repetitionsCount + originalEventCount;
    });

    let projectIds: string[] = [];

    await asyncForEach(Object.entries(workspaceEventsCount), async ([workspaceId, eventsCount]) => {
      const workspace = workspacesMap[workspaceId];

      await this.workspacesCollection.updateOne(
        { _id: workspace._id },
        { $set: { billingPeriodEventsCount: eventsCount } }
      );

      if (workspace.tariffPlan.eventsLimit <= eventsCount) {
        projectIds = [
          ...projectIds,
          ...projects.filter(project => project.workspaceId.toString() === workspaceId).map(project => project._id.toString()),
        ];
      }
    });

    return new Promise((resolve, reject) => {
      this.redisClient.multi()
        .del(this.redisDisabledProjectsKey)
        .sadd(this.redisDisabledProjectsKey, projectIds)
        .exec(function (execError, results) {
          if (execError) {
            console.log('error');

            reject(execError);

            return;
          }
          console.log('success');
          resolve(results);
        });
    });
  }
}
