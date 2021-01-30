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
import { CriticalError } from '../../../lib/workerErrors';
import { HOURS_IN_DAY, MINUTES_IN_HOUR, MS_IN_SEC, SECONDS_IN_MINUTE } from '../../../lib/utils/consts';
import LimiterEvent, { CheckSingleWorkspaceEvent } from '../types/eventTypes';

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
   *
   * @param event - worker event to handle
   */
  public async handle(event: LimiterEvent): Promise<void> {
    this.logger.info('Limiter worker started task');

    switch (event.type) {
      case 'check-single-workspace':
        return this.handleCheckSingleWorkspaceEvent(event);
      case 'regular-workspaces-check':
        return this.handleRegularWorkspacesCheck();
    }

    this.logger.info('Limiter worker finished task');
  }

  /**
   * Handles event for checking events count for specified workspace
   *
   * @param event - event to handle
   */
  private async handleCheckSingleWorkspaceEvent(event: CheckSingleWorkspaceEvent): Promise<void> {
    const workspace = await this.getWorkspaceWithTariffPlan(event.workspaceId);
    const workspaceProjects = await this.getProjects(event.workspaceId);
    const workspaceProjectsIds = workspaceProjects.map(p => p._id.toString());

    const report = await this.analyzeWorkspaceData(workspace, workspaceProjects);

    // await this.updateWorkspacesEventsCount([ report.updatedWorkspace ]);
    //
    // if (report.isBanned) {
    //   await this.appendBannedProjectsToRedis(workspaceProjectsIds);
    // } else {
    //   await this.removeBannedProjectsFromRedis(workspaceProjectsIds);
    // }
    //
    // await this.sendSingleWorkspacesCheckReport(report);
  }

  /**
   * Handles event for for checking current total events count in workspaces
   * and limits events receiving if workspace exceed the limit
   */
  private async handleRegularWorkspacesCheck(): Promise<void> {
    const report = await this.analyzeWorkspacesLimits();

    await this.updateWorkspacesEventsCount(report.updatedWorkspaces);
    await this.saveToRedis(report.bannedProjectIds);

    await this.sendRegularWorkspacesCheckReport(report);
  }

  /**
   * Checks which workspaces reached the limit and return them along with their projects ids.
   * Also, updates workspace current event count in db.
   */
  private async analyzeWorkspacesLimits(): Promise<ReportData & {updatedWorkspaces: WorkspaceWithTariffPlan[]}> {
    const bannedWorkspaces: WorkspaceWithTariffPlan[] = [];
    const updatedWorkspaces: WorkspaceWithTariffPlan[] = [];
    const bannedProjectIds: string[] = [];
    const [projects, workspacesWithTariffPlans] = await Promise.all([
      this.getProjects(),
      this.getWorkspacesWithTariffPlans(),
    ]);

    await asyncForEach(workspacesWithTariffPlans, async workspace => {
      const workspaceProjects = projects.filter(p => p.workspaceId.toString() === workspace._id.toString());

      const { isBanned, updatedWorkspace } = await this.analyzeWorkspaceData(workspace, workspaceProjects);

      if (isBanned) {
        bannedProjectIds.push(...workspaceProjects.map(p => p._id.toString()));
        bannedWorkspaces.push(updatedWorkspace);
      }
      updatedWorkspaces.push(updatedWorkspace);
    });

    return {
      bannedWorkspaces,
      bannedProjectIds,
      updatedWorkspaces,
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
   * Returns all projects from Database or projects of the specified workspace
   *
   * @param [workspaceId] - workspace ids to fetch projects that belongs that workspace
   */
  private getProjects(workspaceId?: string): Promise<ProjectDBScheme[]> {
    const query = workspaceId
      ? { workspaceId: new ObjectId(workspaceId) }
      : {};

    return this.projectsCollection.find(query).toArray();
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
   * Returns workspace with its tariff plan by its id
   *
   * @param id - workspace id
   */
  private async getWorkspaceWithTariffPlan(id: string): Promise<WorkspaceWithTariffPlan> {
    const workspacesArray = await this.workspacesCollection.aggregate<WorkspaceWithTariffPlan>([
      {
        $match: {
          _id: new ObjectId(id),
        },
      },
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

    return workspacesArray.pop();
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
  private async sendRegularWorkspacesCheckReport(reportData: ReportData): Promise<void> {
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

  /**
   * @param workspace
   * @param projects
   */
  private async analyzeWorkspaceData(workspace: WorkspaceWithTariffPlan, projects: ProjectDBScheme[]): Promise<{
    isBanned: boolean;
    updatedWorkspace: WorkspaceWithTariffPlan
  }> {
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

    const workspaceEventsCount = await this.getEventsCountByProjects(projects, since);
    const updatedWorkspace = {
      ...workspace,
      billingPeriodEventsCount: workspaceEventsCount,
    };

    return {
      isBanned: workspace.tariffPlan.eventsLimit < workspaceEventsCount,
      updatedWorkspace,
    };
  }

  /**
   * Updates workspaces data in Database
   *
   * @param workspaces - workspaces data to update
   */
  private async updateWorkspacesEventsCount(workspaces: WorkspaceDBScheme[]): Promise<void> {
    const operations = workspaces.map(workspace => {
      return {
        updateOne: {
          filter: {
            _id: workspace._id,
          },
          update: { $set: { billingPeriodEventsCount: workspace.billingPeriodEventsCount } },
        },
      };
    });

    await this.workspacesCollection.bulkWrite(operations);
  }
}
