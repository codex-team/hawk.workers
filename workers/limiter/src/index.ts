import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import asyncForEach from '../../../lib/utils/asyncForEach';
import { Collection, Db, ObjectId } from 'mongodb';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ProjectDBScheme, WorkspaceDBScheme } from '@hawk.so/types';
import HawkCatcher from '@hawk.so/nodejs';
import { CriticalError } from '../../../lib/workerErrors';
import { MS_IN_SEC } from '../../../lib/utils/consts';
import LimiterEvent, { CheckSingleWorkspaceEvent } from '../types/eventTypes';
import RedisHelper from './redisHelper';
import { MultiplyWorkspacesAnalyzeReport, SingleWorkspaceAnalyzeReport } from '../types/reportData';
import { WorkspaceWithTariffPlan } from '../types';
import * as WorkerNames from '../../../lib/workerNames';
import * as telegram from '../../../lib/utils/telegram';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * List of threshold to notify after
 *
 * @todo implement support for sending single
 *       one message per threshold
 */
const NOTIFY_ABOUT_LIMIT = [
  /**
   * Start notify after 95%
   */
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  0.95,
];

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
   * Redis helper instance for modifying data through redis
   */
  private redis = new RedisHelper();

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    this.eventsDbConnection = await this.eventsDb.connect();
    const accountDbConnection = await this.accountsDb.connect();

    this.projectsCollection = accountDbConnection.collection<ProjectDBScheme>('projects');
    this.workspacesCollection = accountDbConnection.collection<WorkspaceDBScheme>('workspaces');

    await this.redis.initialize();

    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    await super.finish();
    await this.eventsDb.close();
    await this.accountsDb.close();
    await this.redis.close();
  }

  /**
   * Task handling function
   *
   * @param event - worker event to handle
   */
  public async handle(event: LimiterEvent): Promise<void> {
    switch (event.type) {
      case 'check-single-workspace':
        return this.handleCheckSingleWorkspaceEvent(event);
      case 'regular-workspaces-check':
        return this.handleRegularWorkspacesCheck();
    }
  }

  /**
   * Handles event for checking events count for specified workspace
   *
   * @param event - event to handle
   */
  private async handleCheckSingleWorkspaceEvent(event: CheckSingleWorkspaceEvent): Promise<void> {
    const workspace = await this.getWorkspaceWithTariffPlan(event.workspaceId);

    if (!workspace) {
      this.logger.info(`No workspace with id ${event.workspaceId}. Finishing task`);

      return;
    }

    const workspaceProjects = await this.getProjects(event.workspaceId);
    const workspaceProjectsIds = workspaceProjects.map(p => p._id.toString());

    const report = await this.analyzeWorkspaceData(workspace, workspaceProjects);

    await this.updateWorkspacesEventsCount([ report.updatedWorkspace ]);

    if (report.isBlocked) {
      const blockedProjectNames: string[] = [];

      Promise.all(workspaceProjects.map(async (project) => {
        /**
         * If project is not banned yet
         */
        if (!(await this.redis.isProjectBanned(project._id.toString()))) {
          blockedProjectNames.push(project.name);
        }
      }));

      await this.redis.appendBannedProjects(workspaceProjectsIds);

      this.sendSingleWorkspaceReport(blockedProjectNames, 'Blocked');
    } else {
      const unblockedProjectNames: string[] = [];

      Promise.all(workspaceProjects.map(async (project) => {
        /**
         * If project is not banned yet
         */
        if (await this.redis.isProjectBanned(project._id.toString())) {
          unblockedProjectNames.push(project.name);
        }
      }));

      await this.redis.removeBannedProjects(workspaceProjectsIds);

      this.sendSingleWorkspaceReport(unblockedProjectNames, 'Unblocked');
    }

    this.logger.debug(`Block status for workspace ${event.workspaceId} was successfully saved to Redis`);

    this.logger.info(
      `Limiter worker finished workspace checking. Workspace with id "${event.workspaceId}" was ${report.isBlocked ? 'banned' : 'unbanned'}`
    );
  }

  /**
   * Handles event for checking current total events count in workspaces
   * and limits events receiving if workspace exceed the limit
   */
  private async handleRegularWorkspacesCheck(): Promise<void> {
    this.logger.info('Limiter worker started regular check');

    const report = await this.analyzeWorkspacesLimits();

    const findProject = async (projectId): Promise<ProjectDBScheme> => {
      return await this.projectsCollection.findOne({
        _id: ObjectId(projectId),
      });
    };

    const currentlyBannedProjectIds = await this.redis.getBannedProjectIds();

    const unblockedProjectNames: string[] = [];
    const blockedProjectNames: string[] = [];

    /**
     * Find all the projects that would be unblocked
     * And accumulate all of the unblocked project names
     */
    Promise.all(currentlyBannedProjectIds.map(async (projectId) => {
      if (!(report.bannedProjectIds.includes(projectId))) {
        const project = await findProject(projectId);

        unblockedProjectNames.push(project?.name);
      }
    }));

    /**
     * Find all the projects that would be blocked
     * And accumulate all of the blocked project names
     */
    Promise.all(report.bannedProjectIds.map(async (projectId) => {
      /**
       * If project is not in the set now, it would be blocked
       */
      if (!(await this.redis.isProjectBanned(projectId))) {
        const project = await findProject(projectId);

        blockedProjectNames.push(project?.name);
      }
    }));

    await this.updateWorkspacesEventsCount(report.updatedWorkspaces);
    await this.redis.saveBannedProjectsSet(report.bannedProjectIds);

    this.sendRegularReport(blockedProjectNames, unblockedProjectNames);

    this.logger.info('Limiter worker finished task');
  }

  /**
   * Checks which workspaces reached the limit and return them along with their projects ids.
   * Also, updates workspace current event count in db.
   */
  private async analyzeWorkspacesLimits(): Promise<MultiplyWorkspacesAnalyzeReport> {
    const bannedWorkspaces: WorkspaceWithTariffPlan[] = [];
    const updatedWorkspaces: WorkspaceWithTariffPlan[] = [];
    const bannedProjectIds: string[] = [];
    const [projects, workspacesWithTariffPlans] = await Promise.all([
      this.getProjects(),
      this.getWorkspacesWithTariffPlans(),
    ]);

    await asyncForEach(workspacesWithTariffPlans, async workspace => {
      const workspaceProjects = projects.filter(p => p.workspaceId.toString() === workspace._id.toString());

      try {
        const { isBlocked, updatedWorkspace } = await this.analyzeWorkspaceData(workspace, workspaceProjects);

        if (isBlocked) {
          bannedProjectIds.push(...workspaceProjects.map(p => p._id.toString()));
          bannedWorkspaces.push(updatedWorkspace);
        }

        updatedWorkspaces.push(updatedWorkspace);
      } catch (e) {
        this.logger.error(e);
      }
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
    this.logger.info('analyzeWorkspacesLimits -> getWorkspacesWithTariffPlans');

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
    ]).toArray();
  }

  /**
   * Returns workspace with its tariff plan by its id
   *
   * @param id - workspace id
   */
  private async getWorkspaceWithTariffPlan(id: string): Promise<WorkspaceWithTariffPlan> {
    this.logger.info('handleCheckSingleWorkspaceEvent -> getWorkspaceWithTariffPlan: ' + id);
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
   * Analyses workspace data and gives a report about events limit
   *
   * @param workspace - workspace data to check
   * @param projects - workspaces projects
   *
   * @returns {{isBlocked: boolean, updatedWorkspace: WorkspaceDBScheme}}
   */
  private async analyzeWorkspaceData(
    workspace: WorkspaceWithTariffPlan, projects: ProjectDBScheme[]
  ): Promise<SingleWorkspaceAnalyzeReport> {
    /**
     * If last charge date is not specified, then we skip checking it
     * In the next time the Paymaster worker starts, it will set lastChargeDate for this workspace
     * and limiter will process it successfully
     */
    if (!workspace.lastChargeDate) {
      const error = new Error('Workspace without lastChargeDate detected');

      HawkCatcher.send(error, {
        workspaceId: workspace._id.toString(),
      });

      throw error;
    }

    const since = Math.floor(new Date(workspace.lastChargeDate).getTime() / MS_IN_SEC);

    const workspaceEventsCount = await this.getEventsCountByProjects(projects, since);
    const usedQuota = workspaceEventsCount / workspace.tariffPlan.eventsLimit;
    const quotaNotification = NOTIFY_ABOUT_LIMIT.reverse().find(quota => quota < usedQuota);

    const shouldBeBlocked = usedQuota >= 1;
    const isAlreadyBlocked = workspace.isBlocked;

    /**
     * Send notification if workspace will be blocked cause events limit
     */
    if (!isAlreadyBlocked && shouldBeBlocked) {
      /**
       * Add task for Sender worker
       */
      await this.addTask(WorkerNames.EMAIL, {
        type: 'block-workspace',
        payload: {
          workspaceId: workspace._id,
        },
      });
    } else if (quotaNotification) {
      /**
       * Add task for Sender worker
       */
      await this.addTask(WorkerNames.EMAIL, {
        type: 'events-limit-almost-reached',
        payload: {
          workspaceId: workspace._id,
          eventsCount: workspaceEventsCount,
          eventsLimit: workspace.tariffPlan.eventsLimit,
        },
      });
    }

    const updatedWorkspace = {
      ...workspace,
      billingPeriodEventsCount: workspaceEventsCount,
      isBlocked: isAlreadyBlocked || shouldBeBlocked,
    };

    return {
      isBlocked: isAlreadyBlocked || shouldBeBlocked,
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
          update: {
            $set: {
              billingPeriodEventsCount: workspace.billingPeriodEventsCount,
              isBlocked: workspace.isBlocked,
            },
          },
        },
      };
    });

    await this.workspacesCollection.bulkWrite(operations);
  }

  /**
   * Method that formats project list to html used in report messages
   *
   * @param title - title of the section (blocked or unblockes projects)
   * @param projectNames - names of the projects
   * @returns {string} formatted html string
   */
  private formatProjectList(title: string, projectNames: string[]): string {
    if (projectNames.length === 0) {
      return `<b>${title}</b>\n<code>(none)</code>`;
    }

    return `<b>${title}</b>\n${projectNames.map(name => `• ${name}`).join('\n')}`;
  }

  /**
   * Method that sends singele workspace check report ti tg chat with telegram util
   *
   * @param projects - names of blocked or unblocked projects
   * @param type - workspace was blocked or unblocked
   */
  private sendSingleWorkspaceReport(projects: string[], type: 'Blocked' | 'Unblocked'): void {
    if (projects.length === 0) {
      return;
    }

    const message = this.formatProjectList(`${type} workspaces`, projects);

    telegram.sendMessage(`🔐 <b>[ Limiter / Single ]</b>\n${message}`, telegram.TelegramBotURLs.Limiter);
  }

  /**
   * Method that sends regular workspace check report ti tg chat with telegram util
   *
   * @param blockedProjects - names of blocked projects
   * @param unblockedProjects - names of unblocked projects
   */
  private sendRegularReport(blockedProjects: string[], unblockedProjects: string[]): void {
    if (blockedProjects.length === 0 || unblockedProjects.length === 0) {
      return;
    }

    const message = `🔐 <b>[ Limiter / Regular ]</b>\n` +
    this.formatProjectList('Blocked projects', blockedProjects) + '\n\n' +
    this.formatProjectList('Unblocked projects', unblockedProjects);

    telegram.sendMessage(message, telegram.TelegramBotURLs.Limiter);
  }
}
