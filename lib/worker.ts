import {Channel, Connection, ConsumeMessage, Message} from 'amqplib';
import * as amqp from 'amqplib';
import * as dotenv from 'dotenv';
import * as path from 'path';
import winston from 'winston';
import {createLogger, format, transports} from 'winston';
import {WorkerTask} from './types/worker-task';

const {combine, timestamp, colorize, simple, printf} = format;

dotenv.config({path: path.resolve(__dirname, '../.env')});

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
   * Worker type
   * (will pull tasks from Registry queue with the same name)
   */
  public abstract readonly type: string;

  /**
   * Registry Endpoint
   */
  private readonly registryUrl: string = process.env.REGISTRY_URL || 'amqp://localhost';

  /**
   * How many task Worker should do concurrently
   */
  private readonly simultaneousTasks: number = +process.env.SIMULTANEOUS_TASKS || 1;

  /**
   * Registry connection status true/false
   */
  private registryConnected: boolean = false;

  /**
   * Registry Consumer Tag (unique worker identifier, even for one-type workers).
   * Used to cancel subscription
   */
  private registryConsumerTag: string = '';

  /**
   * Connection to Registry
   */
  private registryConnection: Connection;

  /**
   * Channel is a "transport-way" between Consumer and Registry inside the connection
   * One connection can has several channels.
   */
  private channelWithRegistry: Channel;

  /**
   * {Map<Object, Promise>} tasksMap - current worker's tasks
   */
  private tasksMap: Map<object, Promise<void>> = new Map();

  /**
   * Logger module
   * (default level='info')
   */
  protected logger: winston.Logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports: [
      new transports.Console({
        format: combine(
          timestamp(),
          colorize(),
          simple(),
          printf((msg) => `${msg.timestamp} - ${msg.level}: ${msg.message}`),
        ),
      }),
    ],
  });

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

    const {consumerTag} = await this.channelWithRegistry.consume(this.type, (msg: ConsumeMessage) => {
        const promise = this.processMessage(msg) as Promise<void>;

        this.tasksMap.set(msg, promise);
        promise.then(() => this.tasksMap.delete(msg));
      },
    );

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
   * @param {string} worker - worker's name
   * @param {object} payload - payload object
   */
  public async addTask(worker: string, payload: object): Promise<boolean> {
    return this.channelWithRegistry.sendToQueue(
      worker,
      Buffer.from(JSON.stringify(payload)),
    );
  }

  /**
   * Message handle function
   *
   * @param {WorkerTask} event - Event object from consume method
   */
  protected abstract handle(event: WorkerTask): Promise<void>;

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

    /**
     * Assert queue exists
     */
    await this.channelWithRegistry.assertQueue(this.type);

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
   * @param {Object} msg - Message object from consume method
   * @param {Buffer} msg.content - Message content
   */
  private async requeue(msg: Message): Promise<void> {
    await this.channelWithRegistry.nack(msg);
  }

  /**
   * Enqueue a message to stash queue
   * Invoked on `NonCriticalError` in `handle` method to not lose any data
   * @param {Object} msg - Message object from consume method
   * @param {Buffer} msg.content - Message content
   */
  private async sendToStash(msg: Message): Promise<void> {
    return this.channelWithRegistry.reject(msg, false);
  }

  /**
   * High order message process function
   * Calls `handle(msg)` to do actual work.
   * After that does all the stuff connected to RabbitMQ (ACK, etc)
   *
   * @param {Object} msg - Message object from consume method
   * @param {Buffer} msg.content - Message content
   */
  private async processMessage(msg: ConsumeMessage): Promise<void> {
    let event: WorkerTask;

    try {
      const stringifiedEvent = msg.content.toString();

      event = JSON.parse(stringifiedEvent);

      this.logger.verbose('Received event:\n', {
        message: stringifiedEvent,
      });
    } catch (error) {
      throw new ParsingError(
        'Worker::processMessage: Message parsing error' + error,
      );
    }

    try {
      await this.handle(event);

      /**
       * Let RabbitMQ know that we processed the message
       */
      this.channelWithRegistry.ack(msg);
    } catch (e) {
      this.logger.error('Worker::processMessage: An error occurred:\n', e);

      this.logger.debug('instanceof CriticalError? ' + (e instanceof CriticalError));
      this.logger.debug('instanceof NonCriticalError? ' + (e instanceof NonCriticalError));

      /**
       * Send back message to registry since we failed to handle it
       */
      if (e instanceof CriticalError) {
        this.logger.info('Requeueing msg');
        await this.requeue(msg);
      } else if (e instanceof NonCriticalError) {
        this.logger.info('Sending msg to stash');
        await this.sendToStash(msg);
      } else {
        this.logger.error('Unknown error:\n', e);
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
}

/**
 * Class for critical errors
 * have to stop process
 */
export class CriticalError extends Error {
}

/**
 * Class for non-critical errors
 * have not to stop process
 */
export class NonCriticalError extends Error {
}

/**
 * Simple class for parsing errors
 */
export class ParsingError extends NonCriticalError {
}

/**
 * Class for database errors in workers
 */
export class DatabaseError extends CriticalError {
}

/**
 * Class for validation errors
 */
export class ValidationError extends NonCriticalError {
}
