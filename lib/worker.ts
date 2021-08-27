import * as amqp from 'amqplib';
import * as client from 'prom-client';
import { WorkerTask } from './types/worker-task';
import { CriticalError, ErrorWithContext, NonCriticalError, ParsingError } from './workerErrors';
import { MongoError } from 'mongodb';
import HawkCatcher from '@hawk.so/nodejs';
import CacheController from '../lib/cache/controller';
import createLogger from './logger';
import { EventContext } from 'hawk.types';

/**
 * Base worker class for processing tasks
 *
 * Usage:
 *  - Set env vars (see below)
 *  - Inherit from `Worker` class and implement `handle` method, and define `type`
 *  - Create new instance of your new worker class
 *  - Start it. `await worker.start()`
 *
 * Environment variables:
 *  - `REGISTRY_URL` Registry connection URL
 *  - `SIMULTANEOUS_TASKS` Number of tasks handling simultaneously
 *  - `LOG_LEVEL` Log level. Available: error,warn,info,verbose,debug,silly.
 *    See more https://github.com/winstonjs/winston#logging
 *
 *  Other methods available (see code)
 *
 * Example:
 *  ```
 *  class TestWorker extends Worker {
 *    async handle(msg: HawkEvent){
 *      if (msg){
 *        console.log(msg.content.toBuffer());
 *      }
 *    }
 *  }
 *  ```
 *
 *  Start:
 *    ```
 *     const worker = new TestWorker();
 *     await worker.start();
 *    ```
 */
export abstract class Worker {
  /**
   * Logger module
   * (default level='info')
   */
  protected logger = createLogger();

  /**
   * Cache module.
   * To use it in workers, call this.prepareCache()
   */
  protected cache: CacheController;

  /**
   * Prometheus metrics
   * metricProcessedMessages: prom-client.Counter – number of successfully processed messages
   */
  private metricSuccessfullyProcessedMessages!: client.Counter<string>;

  /**
   * Registry Endpoint
   */
  private readonly registryUrl: string = process.env.REGISTRY_URL;

  /**
   * How many task Worker should do concurrently
   */
  private readonly simultaneousTasks: number = +process.env.SIMULTANEOUS_TASKS || 1;

  /**
   * Registry connection status true/false
   */
  private registryConnected = false;

  /**
   * Registry Consumer Tag (unique worker identifier, even for one-type workers).
   * Used to cancel subscription
   */
  private registryConsumerTag = '';

  /**
   * Connection to Registry
   */
  private registryConnection: amqp.Connection;

  /**
   * Channel is a "transport-way" between Consumer and Registry inside the connection
   * One connection can has several channels.
   */
  private channelWithRegistry: amqp.Channel;

  /**
   * {Map<Object, Promise>} tasksMap - current worker's tasks
   */
  private tasksMap: Map<amqp.ConsumeMessage, Promise<void>> = new Map();

  /**
   * Worker type
   * (will pull tasks from Registry queue with the same name)
   */
  public abstract readonly type: string;

  /**
   * Initialize prometheus metrics
   */
  public initMetrics(): void {
    this.metricSuccessfullyProcessedMessages = new client.Counter({
      name: 'successfully_processed_messages',
      help: 'number of successfully processed messages since last restart',
    });
  }

  /**
   * Get array of available prometheus metrics
   */
  public getMetrics(): client.Counter<string>[] {
    return [ this.metricSuccessfullyProcessedMessages ];
  }

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    if (!this.type) {
      throw new Error('Worker type is not defined');
    }

    if (!this.registryConnected) {
      await this.connect();
    }

    const { consumerTag } = await this.channelWithRegistry.consume(this.type, (msg: amqp.ConsumeMessage) => {
      const promise = this.processMessage(msg) as Promise<void>;

      this.tasksMap.set(msg, promise);
      promise.then(() => this.tasksMap.delete(msg));
    });

    /**
     * Remember consumer tag to cancel subscription in future
     */
    this.registryConsumerTag = consumerTag;
  }

  /**
   * Unsubscribe and disconnect
   * Processes the end of all its current messages and exits
   */
  public async finish(): Promise<void> {
    await this.unsubscribe();

    /**
     * Process remaining tasks
     */
    await Promise.all(this.tasksMap.values());
    await this.disconnect();
  }

  /**
   * Adds task to other worker
   *
   * @param {string} worker - worker's name'
   * @param {object} payload - payload object
   */
  // eslint-disable-next-line @typescript-eslint/ban-types
  public async addTask(worker: string, payload: object): Promise<boolean> {
    return this.channelWithRegistry.sendToQueue(
      worker,
      Buffer.from(JSON.stringify(payload))
    );
  }

  /**
   * Forced clears worker cache
   */
  public clearCache(): void {
    this.cache.flushAll();
  }

  /**
   * Create cache controller instance
   */
  protected prepareCache(): void {
    this.cache = new CacheController({
      prefix: this.type,
    });
  }

  /**
   * Connect to RabbitMQ server
   */
  private async connect(): Promise<void> {
    /**
     * Connect to RabbitMQ
     */
    this.registryConnection = await amqp.connect(this.registryUrl);

    const errorHandler = (error: Error): void => {
      this.logger.error(error);
      HawkCatcher.send(error, {
        workerType: this.type,
      });
    };

    this.registryConnection.on('error', errorHandler);

    /**
     * Open channel inside the connection
     */
    this.channelWithRegistry = await this.registryConnection.createChannel();

    /**
     * Assert queue exists
     */
    await this.channelWithRegistry.assertQueue(this.type);

    this.channelWithRegistry.on('error', errorHandler);

    /**
     * Set prefetch value (process only `prefetchValue` task at one time)
     */
    await this.channelWithRegistry.prefetch(this.simultaneousTasks);

    /**
     * Set connection status
     */
    this.registryConnected = true;
  }

  /**
   * Requeue a message to original queue in Registry
   * Invoked on `CriticalError` in `handle` method to not lose any data
   *
   * @param {object} msg - Message object from consume method
   * @param {Buffer} msg.content - Message content
   */
  private async requeue(msg: amqp.Message): Promise<void> {
    await this.channelWithRegistry.nack(msg);
  }

  /**
   * Enqueue a message to stash queue
   * Invoked on `NonCriticalError` in `handle` method to not lose any data
   *
   * @param {object} msg - Message object from consume method
   * @param {Buffer} msg.content - Message content
   */
  private async sendToStash(msg: amqp.Message): Promise<void> {
    this.logger.info('Sending message to stash');

    return this.channelWithRegistry.reject(msg, false);
  }

  /**
   * High order message process function
   * Calls `handle(msg)` to do actual work.
   * After that does all the stuff connected to RabbitMQ (ACK, etc)
   *
   * @param {object} msg - Message object from consume method
   * @param {Buffer} msg.content - Message content
   */
  private async processMessage(msg: amqp.ConsumeMessage): Promise<void> {
    let event: WorkerTask;

    try {
      const stringifiedEvent = msg.content.toString();

      event = JSON.parse(stringifiedEvent);

      this.logger.verbose('Received event:\n', {
        message: stringifiedEvent,
      });
    } catch (error) {
      throw new ParsingError(
        'Worker::processMessage: Message parsing error' + error
      );
    }

    try {
      await this.handle(event);

      /**
       * Let RabbitMQ know that we processed the message
       */
      this.channelWithRegistry.ack(msg);

      /**
       * Increment counter of successfully processed messages if metrics are enabled
       */
      this.metricSuccessfullyProcessedMessages?.inc();
    } catch (e) {
      let context: EventContext = { task: event as Record<string, never> };

      if (e instanceof ErrorWithContext) {
        context = {
          ...context,
          exceptionContext: e.context,
        };
      }

      HawkCatcher.send(e, context);

      switch (e.constructor) {
        case CriticalError:
          this.logger.error('CriticalError: ', e);
          /**
           * Send message to queue again since we failed to handle it
           */
          this.logger.info('Resend message to queue...');
          await this.requeue(msg);

          /**
           * Throw error to exit the process
           */
          throw e;
        case MongoError:
          this.logger.error('MongoError: ', e);
          await this.sendToStash(msg);

          /**
           * Throw error to exit the process
           */
          throw e;
        case NonCriticalError:
          this.logger.error('NonCriticalError: ', e);
          await this.sendToStash(msg);

          return;
        default:
          this.logger.error('Unknown error: ', e);
          await this.sendToStash(msg);
      }
    }
  }

  /**
   * Unsubscribe from messages
   */
  private async unsubscribe(): Promise<void> {
    if (this.registryConsumerTag) {
      /**
       * Cancel the consumer
       */
      await this.channelWithRegistry.cancel(this.registryConsumerTag);
    }
  }

  /**
   * Disconnect from RabbitMQ server
   */
  private async disconnect(): Promise<void> {
    if (this.registryConsumerTag) {
      /**
       * Cancel the consumer first if present
       */
      await this.channelWithRegistry.cancel(this.registryConsumerTag);
    }

    /**
     * Close the channel and connection
     */
    if (this.channelWithRegistry) {
      await this.channelWithRegistry.close();
    }

    if (this.registryConnection) {
      await this.registryConnection.close();
    }

    this.registryConnected = false;
  }

  /**
   * Message handle function
   *
   * @param {WorkerTask} event - Event object from consume method
   */
  protected abstract handle(event: WorkerTask): Promise<void>;
}
