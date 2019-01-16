const path = require('path');
const amqp = require('amqplib');

const { Worker } = require('./worker');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

/**
 * Temp variable for storing either worker consumed at least one message or not
 */
let consumed = false;

/**
 * Worker class for testing
 *
 * @class TestWorker
 * @extends {Worker}
 */
class TestWorker extends Worker {
  /**
   * Async sleep
   *
   * @param {number} ms
   * @returns Promise
   * @memberof TestWorker
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Message handle function
   *
   * @param {Object} msg Message object from consume method
   * @param {Buffer} msg.content Message content
   * @memberof TestWorker
   */
  async handle(msg) {
    if (msg) {
      await this.sleep(500);

      // Show jest that we consumed a message
      consumed = true;

      // Manually ACK
      // this.channel.ack(msg);

      // Cancel subscription after receiving one message, meaning receiving test passed.
      await this.channel.cancel(this._consumerTag);
    }
  }
}

describe('Worker', () => {
  let worker;

  /**
   * Add messages to queue before tests
   **/
  beforeAll(async () => {
    const conn = await amqp.connect(process.env.RABBIT_URL);
    const channel = await conn.createChannel();

    await channel.assertQueue(process.env.RABBIT_QUEUE_NAME);

    for (let i = 0; i < 50; i++) {
      channel.sendToQueue(process.env.RABBIT_QUEUE_NAME, Buffer.from('testt'));
    }

    await channel.close();
    await conn.close();
  });

  it('creates instance', async () => {
    await expect(() => {
      worker = new TestWorker();
    }).not.toThrowError();
  });

  it('connects to server', async () => {
    await expect(worker.connect()).resolves.not.toThrowError();
    expect(worker.connected).toBe(true);
  });

  it('disconnects from server', async () => {
    await expect(worker.disconnect()).resolves.not.toThrowError();
    expect(worker.connected).toBe(false);
  });

  it('consumes messages', async () => {
    try {
      await worker.start();

      // Sleep, let the worker consume message
      await worker.sleep(1000);
      await worker.disconnect();
    } catch (e) {}

    expect(consumed).toBe(true);
  });
});
