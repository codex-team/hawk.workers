import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import asyncForEach from '../../../lib/utils/asyncForEach';
import { Collection, Db } from 'mongodb';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { PlanDBScheme, ProjectDBScheme, WorkspaceDBScheme } from 'hawk.types';
import redis from 'redis';
import HawkCatcher from '@hawk.so/nodejs';
import axios from 'axios';
import shortNumber from 'short-number';
import ReportData from '../types/reportData';
import { CriticalError } from '../../../lib/workerErrors';
import { HOURS_IN_DAY, MINUTES_IN_HOUR, MS_IN_SEC, SECONDS_IN_MINUTE } from '../../../lib/utils/consts';

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

    const { bannedWorkspaces, bannedProjectIds } = await this.getWorkspacesAndProjectsIdsToBan();

    await this.saveToRedis(bannedProjectIds);

    await this.sendReport({
      bannedWorkspaces,
      bannedProjectIds,
    });

    this.logger.info('Limiter worker finished task');
  }

  /**
   * Checks which workspaces reached the limit and return them along with their projects ids.
   * Also, updates workspace current event count in db.
   */
  private async getWorkspacesAndProjectsIdsToBan(): Promise<ReportData> {
    const bannedWorkspaces: WorkspaceWithTariffPlan[] = [];
    const bannedProjectIds: string[] = [];
    const [projects, workspacesWithTariffPlans] = await Promise.all([
      this.getAllProjects(),
      this.getWorkspacesWithTariffPlans(),
    ]);

    await asyncForEach(workspacesWithTariffPlans, async workspace => {
      const workspaceProjects = projects.filter(p => p.workspaceId.toString() === workspace._id.toString());

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

      const since = Math.floor(new Date(workspace.lastChargeDate).getTime() / MS_IN_SEC);

      const workspaceEventsCount = await this.getEventsCountByProjects(workspaceProjects, since);

      await this.updateWorkspaceEventsCount(workspace, workspaceEventsCount);

      if (workspace.tariffPlan.eventsLimit < workspaceEventsCount) {
        bannedProjectIds.push(...workspaceProjects.map(p => p._id.toString()));
        bannedWorkspaces.push({
          ...workspace,
          billingPeriodEventsCount: workspaceEventsCount,
        });
      }
    });

    return {
      bannedWorkspaces,
      bannedProjectIds,
    };
  }

  /**
   * Calculates total events count for all provided projects since the specific date
   *
   * @param projects - projects to calculate for
   * @param since - timestamp of the time from which we count the events
   */
  private async getEventsCountByProjects(projects: ProjectDBScheme[], since: number): Promise<number> {
    const sum = (array: number[]): number => array.reduce((acc, val) => acc + val, 0);

    return Promise.all(projects.map(
      project => this.getEventsCountByProject(project, since)
    ))
      .then(sum);
  }

  /**
   * Updates events counter during billing period for workspace
   *
   * @param workspace — workspace id for updating
   * @param workspaceEventsCount - workspaces events count to set
   */
  private async updateWorkspaceEventsCount(workspace: WorkspaceDBScheme, workspaceEventsCount: number): Promise<void> {
    await this.workspacesCollection.updateOne(
      { _id: workspace._id },
      { $set: { billingPeriodEventsCount: workspaceEventsCount } }
    );
  }

  /**
   * Saves banned project ids to redis
   * If there is no projects, then previous data in Redis will be erased
   *
   * @param projectIdsToBan - ids to ban
   */
  private saveToRedis(projectIdsToBan: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const callback = (execError: Error|null): void => {
        if (execError) {
          this.logger.error(execError);
          HawkCatcher.send(execError);

          reject(execError);

          return;
        }
        this.logger.info('Successfully saved to Redis');
        resolve();
      };

      if (projectIdsToBan.length) {
        this.redisClient.multi()
          .del(this.redisDisabledProjectsKey)
          .sadd(this.redisDisabledProjectsKey, projectIdsToBan)
          .exec(callback);
      } else {
        this.redisClient.del(this.redisDisabledProjectsKey, callback);
      }
    });
  }

  /**
   * Returns all projects from Database
   */
  private getAllProjects(): Promise<ProjectDBScheme[]> {
    return this.projectsCollection.find({}).toArray();
  }

  /**
   * Returns array of workspaces with their tariff plans
   */
  private async getWorkspacesWithTariffPlans(): Promise<WorkspaceWithTariffPlan[]> {
    return this.workspacesCollection.aggregate<WorkspaceWithTariffPlan>([
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
      {
        $addFields: {
          billingPeriodEventsCount: 0,
        },
      },
    ]).toArray();
  }

  /**
   * Returns total event counts for last billing period
   *
   * @param project - project to check
   * @param since - timestamp of the time from which we count the events
   */
  private async getEventsCountByProject(
    project: ProjectDBScheme,
    since: number
  ): Promise<number> {
    this.logger.info(`Processing project with id ${project._id}`);
    const repetitionsCollection = this.eventsDbConnection.collection('repetitions:' + project._id);
    const eventsCollection = this.eventsDbConnection.collection('events:' + project._id);

    const query = {
      'payload.timestamp': {
        $gt: since,
      },
    };

    try {
      const [repetitionsCount, originalEventCount] = await Promise.all([
        repetitionsCollection.find(query).count(),
        eventsCollection.find(query).count(),
      ]);

      return repetitionsCount + originalEventCount;
    } catch (e) {
      HawkCatcher.send(e);
      throw new CriticalError(e);
    }
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

        const millisecondsInDay = HOURS_IN_DAY * MINUTES_IN_HOUR * SECONDS_IN_MINUTE * MS_IN_SEC;
        const timeInDays = Math.floor(timeFromLastChargeDate / millisecondsInDay);

        report += `\n${encodeURIComponent(workspace.name)} | <code>${workspace._id}</code> | ${shortNumber(workspace.billingPeriodEventsCount)} in ${timeInDays} days`;
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
