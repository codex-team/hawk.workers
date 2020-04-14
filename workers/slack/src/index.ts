import {Worker} from "../../../lib/worker";
import {WorkerTask} from "../../../lib/types/worker-task";
import * as pkg from '../package.json';
import {DatabaseController} from "../../../lib/db/controller";
import {Sender} from "./provider/sender";
import WebhookSender from "./provider/webhook";
import {Renderer, EventTypes} from "./renderer";

/**
 * Slacker sender worker
 */
export default class SlackSender extends Worker {
  /**
   * Worker type
   */
  public readonly type: string = pkg.workerType;

  /**
   * Database controllers
   */
  private eventsDb: DatabaseController = new DatabaseController();
  private accountsDb: DatabaseController = new DatabaseController();

  /**
   * Slack sender provider
   */
  private sender: Sender = new WebhookSender();

  /**
   * Slack template renderer
   */
  private renderer: Renderer = new Renderer();

  /**
   * Initialize and start consuming
   */
  public async start(): Promise<void> {
    await this.accountsDb.connect(process.env.ACCOUNTS_DB_NAME);
    await this.eventsDb.connect(process.env.EVENTS_DB_NAME);
    await super.start();
  }

  /**
   * Close connections and stop consuming
   */
  public async finish(): Promise<void> {
    await this.accountsDb.close();
    await this.eventsDb.close();
    await super.finish();
  }

  /**
   * Handles message from queue broker
   *
   * @param {WorkerTask} task
   */
  protected async handle(task): Promise<void> {
    for (const {key: groupHash, count} of task.events) {
      const connection = this.eventsDb.getConnection();
      const event = await connection.collection(`events:${task.projectId}`).findOne({ groupHash });
      const daysRepeated = await connection.collection(`dailyEvents:${task.projectId}`).countDocuments({
        groupHash,
      });

      const message = this.renderer.render(event, daysRepeated,count, EventTypes.NEW);
      await this.sender.send(
        task.endpoint,
        message
      );
    }
  }
}
