import {Worker} from "../../../lib/worker";
import {WorkerTask} from "../../../lib/types/worker-task";
import * as pkg from '../package.json';
import {DatabaseController} from "../../../lib/db/controller";
import {Sender} from "./provider/sender";
import WebhookSender from "./provider/webhook";
import {Renderer} from "./renderer";

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
  private renderer: Renderer = new Renderer();

  /**
   * Initialize and start consuming
   */
  public async start(): Promise<void> {
    await this.accountsDb.connect(process.env.ACCOUNTS_DB_NAME);
    await this.eventsDb.connect(process.env.EVENTS_DB_NAME);
    await super.start();

    const mockObj = {
      projectId: "5df4ef8adddfed00224ce3b2",
      endpoint: "https://hooks.slack.com/services/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",
      events: [{
        key: "11da819a3d8c2024d16a55bc27f5ee6d8d572bb802c560495b5d546ad90b6fbb",
        count: 10,
      }],
    };

    this.handle(mockObj);
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
   * @param {WorkerTask} task
   */
  protected async handle(task: WorkerTask): Promise<void> {
    for (const {key: groupHash, count} of task.events) {
      const connection = this.eventsDb.getConnection();
      const event = await connection.collection(`events:${task.projectId}`).findOne({ groupHash });

      const message = this.renderer.render(event);

      await this.sender.send(
        task.endpoint,
        message
      );
    }
  }
}
