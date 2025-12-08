import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ProjectDBScheme, WorkspaceDBScheme } from '@hawk.so/types';
import HawkCatcher from '@hawk.so/nodejs';
import { MS_IN_SEC } from '../../../lib/utils/consts';
import LimiterEvent, { BlockWorkspaceEvent, UnblockWorkspaceEvent } from '../types/eventTypes';
import RedisHelper from './redisHelper';
import { WorkspaceReport } from '../types/reportData';
import { WorkspaceWithTariffPlan } from '../types';
import * as WorkerNames from '../../../lib/workerNames';
import { DbHelper } from './dbHelper';
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
   * Helper class that contains methods for working with events and accounts databases
   */
  private dbHelper: DbHelper;

  /**
   * Redis helper instance for modifying data through redis
   */
  private redis = new RedisHelper();

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    const eventsDbConnection = await this.eventsDb.connect();
    const accountDbConnection = await this.accountsDb.connect();

    const projectsCollection = accountDbConnection.collection<ProjectDBScheme>('projects');
    const workspacesCollection = accountDbConnection.collection<WorkspaceDBScheme>('workspaces');

    this.dbHelper = new DbHelper(projectsCollection, workspacesCollection, eventsDbConnection);

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
      case 'regular-workspaces-check':
        return this.handleRegularWorkspacesCheck();
      case 'block-workspace':
        return this.handleBlockWorkspaceEvent(event);
      case 'unblock-workspace':
        return this.handleUnblockWorkspaceEvent(event);
    }
  }

  /**
   * Handles event for blocking workspace, updates db and redis
   *
   * @param event - event to handle
   */
  private async handleBlockWorkspaceEvent(event: BlockWorkspaceEvent): Promise<void> {
    this.logger.info('handle block workspace event', event);

    const workspace = await this.dbHelper.getWorkspacesWithTariffPlans(event.workspaceId);

    if (!workspace) {
      this.logger.error(`[ Block Workspace ]: Workspace ${event.workspaceId} not found`);

      return;
    }

    /**
     * If workspace is already blocked - do nothing
     */
    if (workspace.isBlocked) {
      return;
    }

    const workspaceProjects = await this.dbHelper.getProjects(event.workspaceId);
    const projectIds = workspaceProjects.map(project => project._id.toString());

    const { updatedWorkspace } = await this.prepareWorkspaceUsageUpdate(workspace, workspaceProjects);

    updatedWorkspace.isBlocked = true;
    await this.dbHelper.updateWorkspacesEventsCountAndIsBlocked([ updatedWorkspace ]);

    this.logger.info('workspace blocked in db ', event.workspaceId);

    await this.redis.appendBannedProjects(projectIds);

    this.sendSingleWorkspaceReport(workspaceProjects, workspace, 'blocked');
  }

  /**
   * Handles event for unblocking workspace, updates db and redis
   *
   * @param event - event to handle
   */
  private async handleUnblockWorkspaceEvent(event: UnblockWorkspaceEvent): Promise<void> {
    const workspace = await this.dbHelper.getWorkspacesWithTariffPlans(event.workspaceId);

    if (!workspace) {
      this.logger.error(`[ Unblock Workspace ]: Workspace ${event.workspaceId} not found`);

      return;
    }

    /**
     * If workspace is already unblocked - do nothing
     */
    if (workspace.isBlocked === false) {
      return;
    }

    const workspaceProjects = await this.dbHelper.getProjects(event.workspaceId);
    const projectIds = workspaceProjects.map(project => project._id.toString());

    /**
     * If workspace should be blocked by quota - then do not unblock it
     */
    const { shouldBeBlockedByQuota, updatedWorkspace } = await this.prepareWorkspaceUsageUpdate(workspace, workspaceProjects);

    if (shouldBeBlockedByQuota) {
      return;
    }

    updatedWorkspace.isBlocked = false;

    await this.dbHelper.updateWorkspacesEventsCountAndIsBlocked([ updatedWorkspace ]);
    await this.redis.removeBannedProjects(projectIds);

    this.sendSingleWorkspaceReport(workspaceProjects, updatedWorkspace, 'unblocked');
  }

  /**
   * Method that handles regular workspaces check
   */
  private async handleRegularWorkspacesCheck(): Promise<void> {
    let message = '';

    const workspaces = await this.dbHelper.getWorkspacesWithTariffPlans();

    const updatedWorkspaces: WorkspaceWithTariffPlan[] = [];

    await Promise.all(workspaces.map(async (workspace) => {
      /**
       * If workspace is already blocked - do nothing
       */
      if (workspace.isBlocked) {
        return;
      }

      const workspaceProjects = await this.dbHelper.getProjects(workspace._id.toString());

      const { shouldBeBlockedByQuota, updatedWorkspace, projectsToUpdate } = await this.prepareWorkspaceUsageUpdate(workspace, workspaceProjects);

      updatedWorkspaces.push(updatedWorkspace);

      /**
       * If there are no projects to update - move on to next workspace
       */
      if (projectsToUpdate.length === 0) {
        return;
      }

      /**
       * If workspace is not blocked yet and it should be blocked by quota - then block it
       */
      if (shouldBeBlockedByQuota) {
        const projectIds = projectsToUpdate.map(project => project._id.toString());

        this.redis.appendBannedProjects(projectIds);
        message += this.formSingleWorkspaceMessage(updatedWorkspace, projectsToUpdate, 'blocked');
      }
    }));

    this.dbHelper.updateWorkspacesEventsCountAndIsBlocked(updatedWorkspaces);

    this.sendRegularReport(message);
  }

  /**
   * Analyses workspace data and gives a report about events limit
   *
   * @param workspace - workspace data to check
   * @param projects - workspaces projects
   *
   * @returns {WorkspaceReport}
   */
  private async prepareWorkspaceUsageUpdate(
    workspace: WorkspaceWithTariffPlan, projects: ProjectDBScheme[]
  ): Promise<WorkspaceReport> {
    this.logger.info('prepareWorkspaceUsageUpdate');

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

    const workspaceEventsCount = await this.dbHelper.getEventsCountByProjects(projects, since);

    this.logger.info(`workspace ${workspace._id} events count since last charge date: ${workspaceEventsCount}`);

    const usedQuota = workspaceEventsCount / workspace.tariffPlan.eventsLimit;
    const quotaNotification = NOTIFY_ABOUT_LIMIT.reverse().find(quota => quota < usedQuota);

    const shouldBeBlockedByQuota = usedQuota >= 1;
    const isAlreadyBlocked = workspace.isBlocked;

    /**
     * Check quota and send notifications if needed
     * - if should be blocked by quota and is not blocked yet -> block and notify
     * - if is about to reach limit -> notify
     */
    if (shouldBeBlockedByQuota) {
      if (!isAlreadyBlocked) {
        this.logger.info(`Workspace ${workspace._id} will be blocked by quota: ${workspaceEventsCount} of ${workspace.tariffPlan.eventsLimit} events used`);

        /**
         * Add task for Sender worker
         */
        await this.addTask(WorkerNames.EMAIL, {
          type: 'block-workspace',
          payload: {
            workspaceId: workspace._id,
          },
        });
      }
    } else if (quotaNotification) {
      /**
       * Notify that workspace is about to reach events limit
       */
      this.logger.info(`Workspace ${workspace._id} is about to reach events limit: ${Math.floor(usedQuota * 100)}% used`);

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
      isBlocked: isAlreadyBlocked || shouldBeBlockedByQuota,
    };

    return {
      shouldBeBlockedByQuota,
      updatedWorkspace,
      projectsToUpdate: projects,
    };
  }

  /**
   * Method that formats project list to html used in report messages
   *
   * @param workspace - status of this workspace was changed
   * @param projects - list of projects of the workspace
   * @param type - workspace was blocked or unblocked
   * @returns {string} formatted html string
   */
  private formSingleWorkspaceMessage(workspace: WorkspaceWithTariffPlan, projects: ProjectDBScheme[], type: 'blocked' | 'unblocked'): string {
    const statusEmoji = type === 'blocked' ? '⛔️' : '✅';

    let message = `\n\n${statusEmoji} Workspace <b>${workspace.name}</b> ${type} <b>(id: <code>${workspace._id}</code>)</b>\n\n\
<b>Quota: ${workspace.billingPeriodEventsCount} of ${workspace.tariffPlan.eventsLimit}</b>\n\
<b>Last Charge Date: ${workspace.lastChargeDate}</b>\n\n`;

    if (projects.length === 0) {
      return message;
    }

    message += `Projects ${type === 'blocked' ? 'added to' : 'removed from'} Redis:\n`;
    message += `${projects.map(project => `• ${project.name} (id: <code>${project._id}</code>)`).join('\n')}`;

    return message;
  }

  /**
   * Method that sends singele workspace check report ti tg chat with telegram util
   *
   * @param projects - names of blocked or unblocked projects
   * @param workspace - blocked or unblocked workspace
   * @param type - workspace was blocked or unblocked
   */
  private sendSingleWorkspaceReport(projects: ProjectDBScheme[], workspace: WorkspaceWithTariffPlan, type: 'blocked' | 'unblocked'): void {
    const message = this.formSingleWorkspaceMessage(workspace, projects, type);

    telegram.sendMessage(`${message}`, telegram.TelegramBotURLs.Limiter);
  }

  /**
   * Method that sends regular workspace check report ti tg chat with telegram util
   *
   * @param message - message to send
   */
  private sendRegularReport(message: string): void {
    /**
     * If no projects to send - do not send message
     */
    if (!message.includes('•')) {
      return;
    }

    telegram.sendMessage(`🔐 <b>[ Limiter / Regular ]</b>${message}`, telegram.TelegramBotURLs.Limiter);
  }
}
