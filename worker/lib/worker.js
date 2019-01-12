const amqp = require('amqplib');

/**
 * Base worker class for processing tasks
 *
 * Usage:
 *  - Inherit from `Worker` class and implement `handle` method
 *  - Create new instance of your new worker class
 *  - Start it. `await worker.start()`
 *
 *  Other methods availbale (see below)
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
 */
class Worker {
  /**
   * Creates an instance of Worker.
   *
   * @param {string} url RabbitMQ URL
   * @param {string} queueName Queue name
   * @memberof Worker
   */
  constructor(url, queueName) {
    this.url = url;
    this.queueName = queueName;
    this.connected = false;
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
    await this.channel.prefetch(1);

    this.connected = true;
  }

  /**
   * Disconnect from RabbitMQ server
   *
   * @memberof Worker
   */
  async disconnect() {
    if (this.consumerTag) {
      await this.channel.cancel(this.consumerTag);
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
   * @memberof TestWorker
   */
  async handle(msg) {
    if (msg) {
      console.log(msg.content.toString());
      this.channel.ack(msg);
    }
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

    this.consumerTag = consumerTag;
  }
}

module.exports = { Worker };
