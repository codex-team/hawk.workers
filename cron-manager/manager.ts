import { CronJob } from 'cron';
import * as amqp from 'amqplib';
import { CronManagerConfig } from './types';

/**
 * Cron manager for adding tasks for some workers to RabbitMQ due to schedule
 */
export default class CronManager {
  /**
   * Jobs store
   */
  private readonly jobs: CronJob[] = [];

  /**
   * Connection to Registry
   */
  private registryConnection?: amqp.Connection;

  /**
   * Registry Endpoint
   */
  private readonly registryUrl: string;

  /**
   * Channel is a "transport-way" between Consumer and Registry inside the connection
   * One connection can has several channels.
   */
  private channelWithRegistry?: amqp.Channel;

  /**
   * Creates manager instance
   *
   * @param registryUrl - registry endpoint to connect
   * @param config - configuration for jobs initialization
   */
  constructor(registryUrl: string, config: CronManagerConfig) {
    this.registryUrl = registryUrl;
    config.tasks.forEach(task => {
      const job = new CronJob(task.schedule, async () => {
        await this.addTask(task.workerName, {
          kek: 'lol',
        });
      });

      this.jobs.push(job);
    });
  }

  /**
   * Adds task to other worker
   *
   * @param workerName - worker's name
   * @param payload - payload object
   */
  public async addTask(workerName: string, payload: object): Promise<boolean> {
    if (!this.channelWithRegistry) {
      throw new Error('Can\'t send task to the queue because there is no connection to the Registry');
    }

    return this.channelWithRegistry.sendToQueue(
      workerName,
      Buffer.from(JSON.stringify(payload))
    );
  }

  /**
   * Starts all jobs
   */
  public async start(): Promise<void> {
    await this.connect();
    this.jobs.forEach(job => job.start());
  }

  /**
   * Connect to RabbitMQ server
   */
  private async connect(): Promise<void> {
    /**
     * Connect to RabbitMQ
     */
    this.registryConnection = await amqp.connect(this.registryUrl);

    /**
     * Open channel inside the connection
     */
    this.channelWithRegistry = await this.registryConnection.createChannel();
  }
}
