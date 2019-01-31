const path = require('path');
const amqp = require('amqplib');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

/**
 * Base worker class for processing tasks
 *
 * Usage:
 *  - Set env vars (see below)
 *  - Inherit from `Worker` class and implement `handle` method, and define `queueName` (see jsdoc)
 *  - Create new instance of your new worker class
 *  - Start it. `await worker.start()`
 *
 * Environment variables:
 *  - `REGISTRY_URL` Registry connection URL
 *  - `SIMULTANEOUS_TASKS` Number of tasks handling simultaneously
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
 * @class Worker
 * @property {string} [url=amqp://localhost] - RabbitMQ connection URL
 * @property {string} queueName - Registry queue name (from where worker gets tasks)
 * @property {number} [prefetchValue=1] - How many tasks can do simultaneously
 * @property {boolean} connected - Registry connection status true/false
 * @property {string} _consumerTag - Registry Consumer Tag. Used to cancel subscription
 */
class Worker {
  /**
   * Creates an instance of Worker.
   *
   * @memberof Worker
   */
  constructor() {
    this.url = process.env.REGISTRY_URL || 'amqp://localhost';
    this.simultaneousTasks = +process.env.SIMULTANEOUS_TASKS || 1;

    this.connected = false;
    this._consumerTag = '';
  }

  /**
   * Registry queue name (from where worker gets tasks)
   *
   * @readonly
   * @memberof Worker
   */
  get queueName() {
    return '';
  }

  /**
   * Connect to RabbitMQ server
   *
   * @memberof Worker
   */
  async connect() {
    // Connect to RabbitMQ
    this.conn = await amqp.connect(this.url);
    // Create channel
    this.channel = await this.conn.createChannel();

    // Assert queue exists
    await this.channel.assertQueue(this.queueName);
    // Set prefetch value (process only `prefetchValue` task at one time)
    await this.channel.prefetch(this.simultaneousTasks);

    // Set connetion status
    this.connected = true;
  }

  /**
   * Disconnect from RabbitMQ server
   *
   * @memberof Worker
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
   * @memberof Worker
   * @abstract
   */
  async handle(msg) {
    throw Error('Unimplemented');
  }

  /**
   * High order message process function
   * Calls `handle(msg)` to do actual work.
   * After that does all the stuff connected to RabbitMQ (ACK, etc)
   *
   * @param {Object} msg - Message object from consume method
   * @param {Buffer} msg.content - Message content
   * @memberof Worker
   * @abstract
   */
  async processMsg(msg) {
    try {
      if (msg) {
        await this.handle(msg);
      }

      // Let RabbitMQ know that we processed the message
      this.channel.ack(msg);
    } catch (e) {
      // Send back message to registry since we failed to handle it
      this.channel.nack(msg);
      console.error(e);
    }
  }

  /**
   * Start consuming messages
   *
   * @memberof Worker
   */
  async start() {
    if (!this.queueName) {
      throw new Error('queueName is not defined!');
    }

    if (!this.connected) {
      await this.connect();
    }

    const { consumerTag } = await this.channel.consume(this.queueName, msg =>
      this.processMsg(msg)
    );

    // Remember consumer tag to cancel subscription in future
    this._consumerTag = consumerTag;
  }

  /**
   * Unsubscribe from messages
   *
   * @memberof Worker
   */
  async unsubscribe() {
    if (this._consumerTag) {
      // Cancel the consumer
      await this.channel.cancel(this._consumerTag);
      this._consumerTag = null;
    }
  }

  /**
   * Finish everything (in case you need to stop handling but not disconnect)
   *
   * @memberof Worker
   */
  async finish() {
    await this.unsubscribe();
    await this.disconnect();
  }
}

module.exports = { Worker };
