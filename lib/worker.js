const amqp = require('amqplib');

/**
 * Base worker class for processing tasks
 *
 * Usage:
 *  - Inherit from `Worker` class and implement `handle` method
 *  - Create new instance of your new worker class
 *  - Start it. `await worker.start()`
 *
 *  Other methods available (see below)
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
 *     const worker = new TestWorker('amqp://localhost', 'test');
 *     await worker.start();
 *    ```
 *
 *
 * @class Worker
 * @property {string} url RabbitMQ URL
 * @property {string} queueName Queue name
 * @property {number} [prefetchValue=1] RabbitMQ Consumer prefetch value (How many tasks can do simultaneously)
 * @property {boolean} connected RabbitMQ connection status true/false
 * @private {string} _consumerTag RabbitMQ Consumer Tag. Used to cancel subscription
 */
class Worker {
  /**
   * Creates an instance of Worker.
   *
   * @param {string} url RabbitMQ URL
   * @param {string} queueName Queue name
   * @param {number} [prefetchValue=1] RabbitMQ Consumer prefetch value (How many tasks can do simultaneously)
   * @memberof Worker
   */
  constructor(url, queueName, prefetchValue) {
    this.url = url;
    this.queueName = queueName;
    if (!prefetchValue) {
      this.prefetchValue = 1;
    }
    this.prefetchValue = prefetchValue;

    this.connected = false;
    this._consumerTag = '';
  }

  /**
   * Connect to RabbitMQ server
   *
   * @memberof Worker
   */
  async connect() {
    this.conn = await amqp.connect(this.url);
    this.channel = await this.conn.createChannel();

    await this.channel.assertQueue(this.queueName);
    await this.channel.prefetch(this.prefetchValue);

    this.connected = true;
  }

  /**
   * Disconnect from RabbitMQ server
   *
   * @memberof Worker
   */
  async disconnect() {
    if (this._consumerTag) {
      await this.channel.cancel(this._consumerTag);
    }
    await this.channel.close();
    await this.conn.close();

    this.connected = false;
  }

  /**
   * Message handle function
   *
   * Remember to do `this.channel.ack(msg)` after processing!
   *
   * @param {Object} msg Message object from consume method
   * @param {Buffer} msg.content Message content
   * @memberof Worker
   */
  async handle(msg) {
    throw Error('Unimplemented');
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

    const { consumerTag } = await this.channel.consume(this.queueName, msg => this.handle(msg));

    this._consumerTag = consumerTag;
  }
}

module.exports = { Worker };
