const path = require('path');
const amqp = require('amqplib');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, colorize, simple, printf } = format;

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

/**
 * Base worker class for processing tasks
 *
 * Usage:
 *  - Set env vars (see below)
 *  - Inherit from `Worker` class and implement `handle` method, and define `type` (see jsdoc)
 *  - Create new instance of your new worker class
 *  - Start it. `await worker.start()`
 *
 * Environment variables:
 *  - `REGISTRY_URL` Registry connection URL
 *  - `SIMULTANEOUS_TASKS` Number of tasks handling simultaneously
 *  - `LOG_LEVEL` Log level. Available: error,warn,info,versobe,debug,silly. See more https://github.com/winstonjs/winston#logging
 *
 *  Other methods available (see code)
 *
 * Example:
 *  ```
 *  class TestWorker extends Worker {
 *    async handle(){
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
 *
 *
 * @property {string} [url=amqp://localhost] - RabbitMQ connection URL
 * @property {string} type - Worker type (will pull tasks from Registry queue with the same name)
 * @property {number} [prefetchValue=1] - How many tasks can do simultaneously
 * @property {boolean} connected - Registry connection status true/false
 * @property {string} _consumerTag - Registry Consumer Tag. Used to cancel subscription
 * @property {winston.Logger} logger - Logger (default level='info')
 */
class Worker {
  /**
   * Creates an instance of Worker
   */
  constructor() {
    this.url = process.env.REGISTRY_URL || 'amqp://localhost';
    this.simultaneousTasks = +process.env.SIMULTANEOUS_TASKS || 1;

    this.connected = false;
    this._consumerTag = '';
  }

  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   *
   * @example errors/nodejs
   */
  static get type() {
    throw new Error(
      'Worker type is not defined! Implement `static get type()` function.'
    );
  }

  /**
   * Connect to RabbitMQ server
   */
  async connect() {
    // Connect to RabbitMQ
    this.conn = await amqp.connect(this.url);
    // Create channel
    this.channel = await this.conn.createChannel();

    // Assert queue exists
    await this.channel.assertQueue(this.constructor.type);
    // Set prefetch value (process only `prefetchValue` task at one time)
    await this.channel.prefetch(this.simultaneousTasks);

    // Set connection status
    this.connected = true;
  }

  /**
   * Disconnect from RabbitMQ server
   */
  async disconnect() {
    if (this._consumerTag) {
      // Cancel the consumer first if present
      await this.channel.cancel(this._consumerTag);
    }

    // Close the channel and connection
    if (this.channel) {
      await this.channel.close();
    }

    if (this.conn) {
      await this.conn.close();
    }

    this.connected = false;
  }

  /**
   * Message handle function
   *
   * @param {Object} msg - Message object from consume method
   * @param {Buffer} msg.content - Message content
   * @abstract
   */
  static async handle(msg) {}

  /**
   * Requeue a message to original queue in Registry
   * Invoked on `CriticalError` in `handle` method to not lose any data
   *
   * @param {Object} msg - Message object from consume method
   * @param {Buffer} msg.content - Message content
   */
  async requeue(msg) {
    await this.channel.nack(msg);
  }

  /**
   * Requeue all processing message to their original queues in Registry
   * Invoked on `finish` method to send all messages to dead-letter queue
   * Should be invoked on process stop not to lose any data
   *
   * @param {Object} msg - Message object from consume method
   * @param {Buffer} msg.content - Message content
   */
  async requeueAll(msg) {
    await this.channel.nackAll();
  }

  /**
   * Enqueue a message to stash queue
   * Invoked on `NonCriticalError` in `handle` method to not lose any data
   *
   * @param {Object} msg - Message object from consume method
   * @param {Buffer} msg.content - Message content
   */
  async sendToStash(msg) {
    await this.channel.reject(msg, false);
  }

  /**
   * High order message process function
   * Calls `handle(msg)` to do actual work.
   * After that does all the stuff connected to RabbitMQ (ACK, etc)
   * @private
   * @param {Object} msg - Message object from consume method
   * @param {Buffer} msg.content - Message content
   */
  async processMessage(msg) {
    let event;

    try {
      const stringifiedEvent = msg.content.toString();

      event = JSON.parse(stringifiedEvent);

      Worker.logger.verbose('Received event:\n', {
        message: stringifiedEvent
      });
    } catch (e) {
      throw new ParsingError('Worker::processMessage: Message parsing error' + e);
    }

    try {
      await this.constructor.handle(event);
      // Let RabbitMQ know that we processed the message
      this.channel.ack(msg);
    } catch (e) {
      Worker.logger.error('Worker::processMessage: An error occurred:\n', e);

      Worker.logger.debug(
        'instanceof CriticalError? ' + (e instanceof CriticalError)
      );
      Worker.logger.debug(
        'instanceof NonCriticalError? ' + (e instanceof NonCriticalError)
      );
      // Send back message to registry since we failed to handle it
      if (e instanceof CriticalError) {
        Worker.logger.info('Requeueing msg');
        this.requeue(msg);
      } else if (e instanceof NonCriticalError) {
        Worker.logger.info('Sending msg to stash');
        this.sendToStash(msg);
      } else {
        Worker.logger.error('Unknown error:\n', e);
      }
    }
  }

  /**
   * Start consuming messages
   */
  async start() {
    if (!this.constructor.type) {
      throw new Error('Worker::start: type is not defined!');
    }

    if (!this.connected) {
      await this.connect();
    }

    const { consumerTag } = await this.channel.consume(this.constructor.type, msg =>
      this.processMessage(msg)
    );

    // Remember consumer tag to cancel subscription in future
    this._consumerTag = consumerTag;
  }

  /**
   * Unsubscribe from messages
   */
  async unsubscribe() {
    if (this._consumerTag) {
      // Cancel the consumer
      await this.channel.cancel(this._consumerTag);

      /**
       * @todo Check the right sequence cancel-nackall or nackall-cancel?
       */
      // Requeue all messages
      await this.requeueAll();

      // Set consumerTag to null after we requeued all messages
      this._consumerTag = null;
      this.channel = null;
    }
  }

  /**
   * Unsubscribe and disconnect
   * Requeues unhandled messages
   */
  async finish() {
    await this.unsubscribe();
    await this.disconnect();
  }
}

Worker.logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new transports.Console({
      format: combine(
        timestamp(),
        colorize(),
        simple(),
        printf(msg => `${msg.timestamp} - ${msg.level}: ${msg.message}`)
      )
    })
  ]
});

/**
 * Class for critical errors
 * have to stop process
 */
class CriticalError extends Error {}

/**
 * Class for non-critical errors
 * have not to stop process
 */
class NonCriticalError extends Error {}

/**
 * Simple class for parsing errors
 */
class ParsingError extends NonCriticalError {}

/**
 * Class for database errors in workers
 */
class DatabaseError extends CriticalError {}

/**
 * Class for errors in data structure
 */
class DataStructError extends NonCriticalError {}

/**
 * Class for validation errors
 */
class ValidationError extends NonCriticalError {}

module.exports = {
  Worker,
  CriticalError,
  NonCriticalError,
  ParsingError,
  DataStructError,
  DatabaseError,
  ValidationError
};
