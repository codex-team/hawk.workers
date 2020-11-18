import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import asyncForEach from '../../../lib/utils/asyncForEach';
import { Collection, Db } from 'mongodb';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { PlanDBScheme, ProjectDBScheme, WorkspaceDBScheme } from 'hawk.types';
import redis from 'redis';

/**
 * Workspace with its tariff plan
 */
type WorkspaceWithTariffPlan = WorkspaceDBScheme & {tariffPlan: PlanDBScheme}

dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Worker for checking current total events count in workspaces and limits events receiving if workspace exceed the limit
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

  /**
   * Redis client for making queries
   */
  private readonly redisClient = redis.createClient({ url: process.env.REDIS_URL });

  /**
   * Redis key for storing banned projects
   */
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
    const projectIdsToBan = await this.getProjectsIdsToBan();

    return this.saveToRedis(projectIdsToBan);
  }

  /**
   * Saves banned project ids to redis
   *
   * @param projectIdsToBan - ids to ban
   */
  private saveToRedis(projectIdsToBan: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.redisClient.multi()
        .del(this.redisDisabledProjectsKey)
        .sadd(this.redisDisabledProjectsKey, projectIdsToBan)
        .exec(function (execError) {
          if (execError) {
            console.log('error');

            reject(execError);

            return;
          }
          console.log('success');
          resolve();
        });
    });
  }

  /**
   * Returns array of project ids for banning
   */
  private async getProjectsIdsToBan(): Promise<string[]> {
    const [projects, workspacesMap] = await Promise.all([
      this.projectsCollection.find({}).toArray(),
      this.getWorkspacesWithTariffPlans(),
    ]);

    /**
     * Stores id and events count for each workspace
     */
    const totalEventsCountByWorkspace = await this.getTotalEventsCountByWorkspace(projects, workspacesMap);

    let projectIds: string[] = [];

    await asyncForEach(Object.entries(totalEventsCountByWorkspace), async ([workspaceId, eventsCount]) => {
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

    return projectIds;
  }

  /**
   * Returns info about total events count for each workspace for the last billing period
   *
   * @param projects - projects to check
   * @param workspacesMap - workspaces to check
   */
  private async getTotalEventsCountByWorkspace(projects: ProjectDBScheme[], workspacesMap: Record<string, WorkspaceWithTariffPlan>): Promise<Record<string, number>> {
    const totalEventsCountByWorkspace: Record<string, number> = {};

    await asyncForEach(projects, async (project) => {
      const totalEventsCount = await this.getProjectEventsCount(project, workspacesMap[project.workspaceId.toString()]);

      totalEventsCountByWorkspace[project.workspaceId.toString()] = (totalEventsCountByWorkspace[project.workspaceId.toString()] || 0) + totalEventsCount;
    });

    return totalEventsCountByWorkspace;
  }

  /**
   * Returns workspaces with their tariff plans
   */
  private async getWorkspacesWithTariffPlans(): Promise<Record<string, WorkspaceWithTariffPlan>> {
    const workspaces = await this.workspacesCollection.aggregate<WorkspaceWithTariffPlan>([
      {
        $lookup: {
          from: 'plans',
          localField: 'tariffPlanId',
          foreignField: '_id',
          as: 'tariffPlan',
        },
      },
      {
        $unwind: {
          path: '$tariffPlan',
        },
      },
    ]).toArray();

    return workspaces.reduce((acc, workspace) => {
      acc[workspace._id.toString()] = workspace;

      return acc;
    }, {} as Record<string, WorkspaceWithTariffPlan>);
  }

  /**
   * Returns total event counts for last billing period
   *
   * @param project - project to check
   * @param workspace - workspace that project belongs to
   */
  private async getProjectEventsCount(project: ProjectDBScheme, workspace: WorkspaceWithTariffPlan): Promise<number> {
    this.logger.info('Processing project with id ' + project._id);

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

    return repetitionsCount + originalEventCount;
  }
}
