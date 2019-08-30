import {ObjectID} from 'mongodb';
import {DatabaseController} from '../../../lib/db/controller';
import {Worker} from "../../../lib/worker";
import {
  NotifyCheckerWorkerTask,
  NotifyCheckerWorkerTaskPayloadGrouper,
  NotifyCheckerWorkerTaskPayloadMerchant,
  notifyTypes
} from "../types/notify-checker-worker-task";
import {eventActions, Notify} from "../../../lib/db/models/notify";
import {Project} from "../../../lib/db/models/project";
import * as WorkerNames from '../../../lib/workerNames';
import * as pkg from '../package.json';

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
   * Check if need to send a notification about merchant event.
   */
  public async checkMerchant(event: NotifyCheckerWorkerTaskPayloadMerchant) {

  }

  /**
   * Message handle function
   */
  public async handle(event: NotifyCheckerWorkerTask): Promise<void> {
    switch (event.type) {
      case notifyTypes.EVENT:
        await this.checkEvent(event.payload as NotifyCheckerWorkerTaskPayloadGrouper);
        break;
      case notifyTypes.MERCHANT:
        await this.checkMerchant(event.payload as NotifyCheckerWorkerTaskPayloadMerchant);
        break;
    }
  }

  /**
   * Check if need to send a notification about new error event and send it.
   */
  private async checkEvent(event: NotifyCheckerWorkerTaskPayloadGrouper) {
    const notifies = await this.getNotifiesByProjectId(event.projectId);
    const project = await this.getProjectById(event.projectId);

    for (const notify of notifies) {
      switch (notify.actionType) {
        case eventActions.ONLY_NEW:
          if (event.new) {
            this.logger.verbose(`Trying to send notification for notify ${JSON.stringify(notify)}\nevent ${JSON.stringify(event)}`);

            if (notify.settings.email && notify.settings.email.enabled) {
              await this.addTask(WorkerNames.NOTIFYEMAIL, {
                to: notify.settings.email.value,
                subject: `VAM OSHIBOCHKA v ${project.name}`,
                text: `Pohozhe u vas trouble :(\n${event.payload.title}`,
                html: `<h1>Pohozhe u vas trouble :(</h1><br><code>${event.payload.title}</code>`
              });
            }

            if (notify.settings.tg && notify.settings.tg.enabled) {
              await this.addTask(WorkerNames.NOTIFYTELEGRAM, {
                hook: notify.settings.tg.value,
                message: `<h1>Pohozhe u vas trouble v ${project.name}:(</h1><br><code>${event.payload.title}</code>`,
                parseMode: 'HTML'
              });
            }

            if (notify.settings.slack && notify.settings.slack.enabled) {
              await this.addTask(WorkerNames.NOTIFYSLACK, {
                hook: notify.settings.tg.value,
                text: `Pohozhe u vas trouble v ${project.name} :(\n\`${event.payload.title}\``
              });
            }
          }
          break;
      }
    }
  }

  /**
   * Find all notify settings for given project ID
   */
  private async getNotifiesByProjectId(projectId: string): Promise<Notify[]> {
    const cursor = this.db.getConnection().collection(`notifies:${projectId}`).find({});

    return cursor.toArray();
  }

  /**
   * Get project by ID
   */
  private async getProjectById(projectId: string): Promise<Project> {
    return this.db.getConnection().collection('projects').findOne({_id: new ObjectID(projectId)});
  }
}
