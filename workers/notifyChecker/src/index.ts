// tslint-ignore ordered-imports
import {config} from 'dotenv';
import {resolve} from 'path';

// Load .env before other imports to set proper vars
config({path: resolve(__dirname, '../.env')});

import {ObjectID} from 'mongodb';
import {DatabaseController} from '../../../lib/db/controller';
import {eventActions, Notify} from '../../../lib/db/models/notify';
import {Project} from '../../../lib/db/models/project';
import {User} from '../../../lib/db/models/user';
import {NonCriticalError, Worker} from '../../../lib/worker';
import * as WorkerNames from '../../../lib/workerNames';
import {NotifyEmailWorkerTask} from '../../notifyEmail/types/notify-email-worker-task';
import {NotifySlackWorkerTask} from '../../notifySlack/types/notify-slack-worker-task';
import {NotifyTelegramWorkerTask} from '../../notifyTelegram/types/notify-telegram-worker-task';
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
        await this.checkEvent(
          task.payload as NotifyCheckerWorkerTaskPayloadGrouper,
        );
        break;
      case notifyTypes.MERCHANT:
        await this.checkMerchant(
          task.payload as NotifyCheckerWorkerTaskPayloadMerchant,
        );
        break;
    }
  }

  /**
   * Check if need to send a notification about merchant event.
   */
  public async checkMerchant(event: NotifyCheckerWorkerTaskPayloadMerchant) {
  }

  /**
   * Send notifications depending on settings. Returns array of email, hooks, etc to which notification was sent
   */
  private async takeAction(
    alreadySent: Set<string>,
    notify: Notify,
    event: NotifyCheckerWorkerTaskPayloadGrouper,
    project: Project,
  ): Promise<string[]> {
    const sentTo = [];

    switch (notify.actionType) {
      case eventActions.ONLY_NEW:
        if (event.new) {
          this.logger.verbose(
            `Trying to send notification for notify ${JSON.stringify(
              notify,
            )}\nevent ${JSON.stringify(event)}`,
          );

          // For each provider check if it is enabled and if it was not used before

          if (
            notify.settings.email &&
            notify.settings.email.enabled &&
            notify.settings.email.value &&
            !alreadySent.has(notify.settings.email.value)
          ) {
            await this.addTask(WorkerNames.NOTIFYEMAIL, {
              to: notify.settings.email.value,
              subject: `VAM OSHIBOCHKA v ${project.name}`,
              text: `Pohozhe u vas trouble :(\n${event.payload.title}`,
              html: `<h1>Pohozhe u vas trouble :(</h1><br><code>${event.payload.title}</code>`,
            } as NotifyEmailWorkerTask);
            sentTo.push(notify.settings.email.value);
          }

          if (
            notify.settings.tg &&
            notify.settings.tg.enabled &&
            notify.settings.tg.value &&
            !alreadySent.has(notify.settings.tg.value)
          ) {
            await this.addTask(WorkerNames.NOTIFYTELEGRAM, {
              hook: notify.settings.tg.value,
              message: `<h1>Pohozhe u vas trouble v ${project.name}:(</h1><br><code>${event.payload.title}</code>`,
              parseMode: 'HTML',
            } as NotifyTelegramWorkerTask);
            sentTo.push(notify.settings.tg.value);
          }

          if (
            notify.settings.slack &&
            notify.settings.slack.enabled &&
            notify.settings.slack.value &&
            !alreadySent.has(notify.settings.slack.value)
          ) {
            await this.addTask(WorkerNames.NOTIFYSLACK, {
              hook: notify.settings.tg.value,
              text: `Pohozhe u vas trouble v ${project.name} :(\n\`${event.payload.title}\``,
            } as NotifySlackWorkerTask);
            sentTo.push(notify.settings.slack.value);
          }
        }
        break;
    }

    return sentTo;
  }

  /**
   * Check if need to send a notification about new error event and send it.
   */
  private async checkEvent(event: NotifyCheckerWorkerTaskPayloadGrouper) {
    const notifies = await this.getNotifiesByProjectId(event.projectId);
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

      sentTo.forEach((address) => {
        alreadySent.add(address);
      });
    }
  }

  /**
   * Find all notify settings for given project ID
   */
  private async getNotifiesByProjectId(projectId: string): Promise<Notify[]> {
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
      .findOne({_id: new ObjectID(projectId)});
  }

  private getUserById(userId: string): Promise<User> {
    return this.db
      .getConnection()
      .collection('users')
      .findOne({_id: new ObjectID(userId)});
  }
}
