import {Worker} from "../../../lib/worker";
import {WorkerTask} from "../../../lib/types/worker-task";
import Decorator from "./decorator";
import {DatabaseController} from "../../../lib/db/controller";

/**
 * Slacker
 */
export default class Slacker extends Worker {
  /**
   * Worker type
   */
  readonly type: string = 'Slack notifier';

  /**
   * IncomingWebhook library decorator
   */
  private lib: Decorator;

  /**
   * Database controller
   */
  private db: DatabaseController = new DatabaseController();

  constructor() {
    super();
    this.lib = new Decorator();
  }

  public async start(): Promise<void> {
    await this.db.connect(process.env.EVENTS_DB_NAME);
    return super.start();
  }

  public async finish(): Promise<void> {
    await this.db.close();
    return super.finish();
  }

  /**
   * @param event
   */
  protected async handle(event: WorkerTask): Promise<void> {

  }

  public async run(): Promise<void> {
    await this.lib.send(
      "https://hooks.slack.com/services/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",
      "privet"
    );
  }
}

const s = new Slacker();
s.run();
