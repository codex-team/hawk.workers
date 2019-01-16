const path = require('path');
const amqp = require('amqplib');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

/**
 * Base worker class for processing tasks
 *
 * Usage:
 *  - Set env vars (see below)
 *  - Inherit from `Worker` class and implement `handle` method
 *  - Create new instance of your new worker class
 *  - Start it. `await worker.start()`
 *
 * Environment variables:
 *  - `RABBIT_URL` RabbitMQ connection URL
 *  - `RABBIT_QUEUE_NAME` RabbitMQ queue name (from where worker gets tasks)
 *  - `RABBIT_PREFETCH` RabbitMQ Consumer prefetch value (How many tasks can do simultaneously)
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
 * @property {string} [queueName=test] - RabbitMQ queue name (from where worker gets tasks)
 * @property {number} [prefetchValue=1] - RabbitMQ Consumer prefetch value (How many tasks can do simultaneously)
 * @property {boolean} connected - RabbitMQ connection status true/false
 * @property {string} _consumerTag - RabbitMQ Consumer Tag. Used to cancel subscription
 */
class Worker {
  /**
   * Creates an instance of Worker.
   *
   * @memberof Worker
   */
  constructor() {
    this.url = process.env.RABBIT_URL || 'amqp://localhost';
    this.queueName = process.env.RABBIT_QUEUE_NAME || 'test';
    this.prefetchValue = +process.env.RABBIT_PREFETCH || 1;

    this.connected = false;
    this._consumerTag = '';
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

    // Assert queue and set prefetch value
    await this.channel.assertQueue(this.queueName);
    await this.channel.prefetch(this.prefetchValue);

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
    await this.channel.close();
    await this.conn.close();

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
    await this.handle(msg);

    // Let RabbitMQ know that we processed the message
    this.channel.ack(msg);
  }

  /**
   * Start consuming messages
   *
   * @memberof Worker
   */
  async start() {
    if (!this.connected) {
      await this.connect();
    }

    const { consumerTag } = await this.channel.consume(this.queueName, msg => this.processMsg(msg));

    // Remember consumer tag to cancel subscription in future
    this._consumerTag = consumerTag;
  }
}

module.exports = { Worker };
