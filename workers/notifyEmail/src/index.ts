import {config} from "dotenv";
import nodemailer from "nodemailer";
import {resolve} from "path";
import {NonCriticalError, Worker} from "../../../lib/worker";
import * as pkg from "../package.json";
import {NotifyEmailWorkerTask} from "../types/notify-email-worker-task";

// Load .env before other imports to set proper vars
config({path: resolve(__dirname, "../.env")});

/**
 * Email notification worker
 */
export default class EmailNotificationWorker extends Worker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public readonly type: string = pkg.workerType;

  /**
   * SMTP transport
   */
  private transport;

  /**
   * Sender options
   */
  private senderOptions: {
    from: string;
  };

  constructor() {
    super();

    if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.USERNAME || !process.env.SMTP_PASSWORD || !process.env.SMTP_SENDER_NAME || !process.env.SMTP_SENDER_ADDRESS) {
      throw new Error("Required parameters are not set, see .env.sample");
    }

    this.transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
      },
    } as any);

    this.senderOptions = {
      from: `"${process.env.SMTP_SENDER_NAME}" <${process.env.SMTP_SENDER_ADDRESS}>`,
    };
  }

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    await super.finish();
  }

  /**
   * Message handle function
   */
  public async handle(task: NotifyEmailWorkerTask): Promise<void> {
    try {
      const info = await this.transport.sendMail({
        ...this.senderOptions,
        to: task.to,
        subject: task.subject,
        text: task.text,
        html: task.html,
      });
      this.logger.verbose(`sent email ${JSON.stringify(info)}`);
    } catch (err) {
      throw new NonCriticalError(err);
    }
  }
}
