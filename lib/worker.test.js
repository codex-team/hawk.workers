const path = require('path');
const amqp = require('amqplib');
const { sleep } = require('./utils');
const { Worker } = require('./worker');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

/**
 * Test worker type
 */
const WORKER_TYPE = 'test';

/**
 * Temp variable for storing either worker consumed at least one message or not
 */
let consumed = false;

/**
 * Worker class for testing
 */
class TestWorker extends Worker {
  constructor(){
    super();
    this.type = WORKER_TYPE;
  }
  /**
   * Message handle function
   *
   * @param {Object} msg Message object from consume method
   * @param {Buffer} msg.content Message content
   */
  async handle(msg) {
    if (msg) {
      // Show jest that we consumed a message
      consumed = true;

      await sleep(500);
    }
  }
}

describe('Worker', () => {
  let conn;
  let channel;

  let worker = new Worker();

  /**
   * Add messages to queue before tests
   *
   */
  beforeAll(async () => {
    conn = await amqp.connect(process.env.REGISTRY_URL);
    channel = await conn.createChannel();

    await channel.assertQueue(WORKER_TYPE);

    for (let i = 0; i < 50; i++) {
      channel.sendToQueue(WORKER_TYPE, Buffer.from('{"test": "testMessage"}'));
    }

    await channel.close();
    await conn.close();
  });

  test('creates instance', async () => {
    await expect(() => {
      worker = new TestWorker();
    }).not.toThrowError();
  });

  test('starts work', async () => {
    await expect(worker.start()).resolves.not.toThrowError();
    expect(worker.registryConnected).toBe(true);
  });

  test('consumes messages', async () => {
    // Sleep, let the worker consume message
    await sleep(1000);

    expect(consumed).toBe(true);
  });

  test('finish work', async () => {
    await worker.finish();
    expect(worker.registryConnected).toBe(false);
  });
});
