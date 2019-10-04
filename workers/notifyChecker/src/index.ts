// tslint-ignore ordered-imports
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env before other imports to set proper vars
config({ path: resolve(__dirname, '../.env') });

import { ObjectID } from 'mongodb';
import { DatabaseController } from '../../../lib/db/controller';
import { notifyActions, NotifySettings } from '../../../lib/db/models/notify';
import { Project } from '../../../lib/db/models/project';
import { User } from '../../../lib/db/models/user';
import { NonCriticalError, Worker } from '../../../lib/worker';
import * as WorkerNames from '../../../lib/workerNames';
import { NotifyEmailWorkerTask } from '../../notifyEmail/types/notify-email-worker-task';
import { NotifySlackWorkerTask } from '../../notifySlack/types/notify-slack-worker-task';
import { NotifyTelegramWorkerTask } from '../../notifyTelegram/types/notify-telegram-worker-task';
import * as pkg from '../package.json';
import {
  NotifyCheckerWorkerTask,
  NotifyCheckerWorkerTaskPayloadGrouper,
  NotifyCheckerWorkerTaskPayloadMerchant,
  notifyTypes,
} from '../types/notify-checker-worker-task';

/**
 * Worker for handling notify check events
 */
export default class NotifyCheckerWorker extends Worker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public readonly type: string = pkg.workerType;

  /**
   * Database Controller
   */
  private db: DatabaseController = new DatabaseController();

  constructor() {
    super();
  }

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.db.connect();
    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    await super.finish();
    await this.db.close();
  }

  /**
   * Task handling function
   */
  public async handle(task: NotifyCheckerWorkerTask): Promise<void> {
    switch (task.type) {
      case notifyTypes.EVENT:
        await this.sendEventNotifications(
          task.payload as NotifyCheckerWorkerTaskPayloadGrouper,
        );
        break;
      case notifyTypes.MERCHANT:
        await this.sendMerchantNotifications(
          task.payload as NotifyCheckerWorkerTaskPayloadMerchant,
        );
        break;
    }
  }

  /**
   * Check if need to send a notification about merchant event.
   */
  public async sendMerchantNotifications(
    event: NotifyCheckerWorkerTaskPayloadMerchant,
  ) {}

  /**
   * Check if need to send a notification about new error event and send it.
   */
  private async sendEventNotifications(
    event: NotifyCheckerWorkerTaskPayloadGrouper,
  ) {
    const notifies = await this.getNotificationSettingsByProjectId(
      event.projectId,
    );
    const project = await this.getProjectById(event.projectId);

    if (!notifies || !project) {
      // Send event to stash == throw non-critical error
      throw new NonCriticalError();
    }

    /**
     * Maintain a set of emails, hooks, etc to which notifications were already sent
     */
    const alreadySent = new Set<string>();

    // First send notifications using project settings
    notifies.unshift(project.notify);

    for (const notify of notifies) {
      // todo: if notify has no email, send to user's email

      const sentTo = await this.takeAction(alreadySent, notify, event, project);

      sentTo.forEach((address: string) => {
        alreadySent.add(address);
      });
    }
  }

  /**
   * Send notifications depending on settings. Returns array of email, hooks, etc to which notification was sent
   */
  private async takeAction(
    alreadySent: Set<string>,
    notifySettings: NotifySettings,
    event: NotifyCheckerWorkerTaskPayloadGrouper,
    project: Project,
  ): Promise<string[]> {
    const sentTo: string[] = [];

    switch (notifySettings.actionType) {
      case notifyActions.ONLY_NEW:
        if (event.new) {
          this.logger.verbose(
            `Trying to send notification for notify ${JSON.stringify(
              notifySettings,
            )}\nevent ${JSON.stringify(event)}`,
          );

          /**
           * For each provider check if it is enabled and if it was not used before
           * @todo: send actual notification
           */
        }
        break;
    }

    return sentTo;
  }

  /**
   * Find all notify settings for given project ID
   */
  private async getNotificationSettingsByProjectId(
    projectId: string,
  ): Promise<NotifySettings[]> {
    const cursor = this.db
      .getConnection()
      .collection(`notifies:${projectId}`)
      .find({});

    return cursor.toArray();
  }

  /**
   * Get project by ID
   */
  private async getProjectById(projectId: string): Promise<Project> {
    return this.db
      .getConnection()
      .collection('projects')
      .findOne({ _id: new ObjectID(projectId) });
  }

  /**
   *
   * Get uset by ID
   */
  private getUserById(userId: string): Promise<User> {
    return this.db
      .getConnection()
      .collection('users')
      .findOne({ _id: new ObjectID(userId) });
  }
}
