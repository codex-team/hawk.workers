import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import asyncForEach from '../../../lib/utils/asyncForEach';
import { Collection, Db, ObjectId } from 'mongodb';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { PlanDBScheme, ProjectDBScheme, WorkspaceDBScheme } from 'hawk.types';
import redis from 'redis';
import HawkCatcher from '@hawk.so/nodejs';
import axios from 'axios';
import shortNumber from 'short-number';
import ReportData from '../types/reportData';

/**
 * Workspace with its tariff plan
 */
type WorkspaceWithTariffPlan = WorkspaceDBScheme & {tariffPlan: PlanDBScheme};

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
  private readonly redisDisabledProjectsKey = 'DisabledProjectsSet';

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
    this.logger.info('Limiter worker started task');
    const reportData: ReportData = {
      workspacesWithoutLastChargeDate: new Set(),
      bannedWorkspaces: [],
      bannedProjectIds: [],
    };

    const projectIdsToBan: string[] = [];

    const [projects, workspacesMap] = await Promise.all([
      this.getAllProjects(),
      this.getWorkspacesWithTariffPlans(),
    ]);

    /**
     * Stores id and events count for each workspace
     */
    const totalEventsCountByWorkspace = await this.calculateWorkspacesTotalEventsCount(projects, workspacesMap);

    /**
     * Iterate over all workspaces and collect banned projects
     */
    await asyncForEach(Object.entries(totalEventsCountByWorkspace), async ([workspaceId, eventsCount]) => {
      const workspace = workspacesMap[workspaceId];

      await this.updateWorkspaceEventsCount(workspace._id, eventsCount);

      if (workspace.tariffPlan.eventsLimit <= eventsCount) {
        workspace.billingPeriodEventsCount = eventsCount;
        reportData.bannedWorkspaces.push(workspace);
        projectIdsToBan.push(
          ...projects
            .filter(project => project.workspaceId.toString() === workspaceId)
            .map(project => project._id.toString())
        );
      }
    });

    reportData.bannedProjectIds = projectIdsToBan;

    if (projectIdsToBan.length) {
      await this.saveToRedis(projectIdsToBan);
    }

    await this.sendReport(reportData);

    this.logger.info('Limiter worker finished task');
  }

  /**
   * Updates events counter during billing period for workspace
   *
   * @param workspaceId — workspace id for updating
   * @param eventsCount - events count to set
   */
  private async updateWorkspaceEventsCount(workspaceId: ObjectId, eventsCount: number): Promise<void> {
    await this.workspacesCollection.updateOne(
      { _id: workspaceId },
      { $set: { billingPeriodEventsCount: eventsCount } }
    );
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
        .exec((execError) => {
          if (execError) {
            this.logger.error(execError);
            HawkCatcher.send(execError);

            reject(execError);

            return;
          }
          this.logger.info('Successfully saved to Redis');
          resolve();
        });
    });
  }

  /**
   * Returns all projects from Database
   */
  private getAllProjects(): Promise<ProjectDBScheme[]> {
    return this.projectsCollection.find({}).toArray();
  }

  /**
   * Returns info about total events count for each workspace for the last billing period
   *
   * @param projects - projects to check
   * @param workspacesMap - workspaces to check
   */
  private async calculateWorkspacesTotalEventsCount(
    projects: ProjectDBScheme[],
    workspacesMap: Record<string, WorkspaceWithTariffPlan>
  ): Promise<Record<string, number>> {
    const totalEventsCountByWorkspace: Record<string, number> = {};

    await asyncForEach(projects, async (project) => {
      this.logger.info('Processing project with id ' + project._id);

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
  private async getProjectEventsCount(
    project: ProjectDBScheme,
    workspace: WorkspaceWithTariffPlan
  ): Promise<number> {
    /**
     * If last charge date is not specified, then we skip checking it
     * In the next time the Paymaster worker starts, it will set lastChargeDate for this workspace
     * and limiter will process it successfully
     */
    if (!workspace.lastChargeDate) {
      HawkCatcher.send(new Error('Workspace without lastChargeDate detected'), {
        workspaceId: workspace._id,
      });

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

  /**
   * Send report with charged workspaces to Telegram
   *
   * @param reportData - data for sending notification after task handling
   */
  private async sendReport(reportData: ReportData): Promise<void> {
    if (!process.env.REPORT_NOTIFY_URL) {
      this.logger.error('Can\'t send report because REPORT_NOTIFY_URL not provided');

      return;
    }

    let report = process.env.SERVER_NAME ? ` Hawk Limiter (${process.env.SERVER_NAME}) 🚧\n` : ' Hawk Limiter 🚧\n';

    if (reportData.bannedWorkspaces.length) {
      report += `\nBanned workspaces:\n`;
      reportData.bannedWorkspaces.forEach((workspace) => {
        const timeFromLastChargeDate = Date.now() - new Date(workspace.lastChargeDate).getTime();
        const millisecondsInDay = 24 * 60 * 60 * 1000;
        const timeInDays = Math.floor(timeFromLastChargeDate / millisecondsInDay);

        report += `\n${encodeURIComponent(workspace.name)} | <code>${workspace._id}</code> | ${shortNumber(workspace.billingPeriodEventsCount)} in ${timeInDays} days`;
      });
    }

    if (reportData.workspacesWithoutLastChargeDate.size) {
      report += `\n\nAlert ⚠️\nWorkspaces without last charge date:\n`;
      reportData.workspacesWithoutLastChargeDate.forEach((workspace) => {
        report += `\n${encodeURIComponent(workspace.name)} | <code>${workspace._id}</code>`;
      });
    }

    report += `\n\n${reportData.bannedWorkspaces.length} workspaces with ${reportData.bannedProjectIds.length} projects totally banned`;

    await axios({
      method: 'post',
      url: process.env.REPORT_NOTIFY_URL,
      data: 'message=' + report + '&parse_mode=HTML',
    });
  }
}
