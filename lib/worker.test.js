const path = require('path');
const amqp = require('amqplib');
const {sleep} = require('./utils');
const {Worker} = require('./worker');

require('dotenv').config({path: path.resolve(__dirname, '../.env')});

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
  /**
   * Worker type
   */
  static get type() {
    return WORKER_TYPE;
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

      // Unsubscribe from messages
      await this.unsubscribe();
    }
  }
}

describe('Worker', () => {
  let conn;
  let channel;

  let worker = new Worker();

  /**
   * Add messages to queue before tests
   **/
  beforeAll(async () => {
    conn = await amqp.connect(process.env.REGISTRY_URL);
    channel = await conn.createChannel();

    await channel.assertQueue(WORKER_TYPE);

    for (let i = 0; i < 50; i++) {
      channel.sendToQueue(WORKER_TYPE, Buffer.from('test'));
    }

    await channel.close();
    await conn.close();
  });

  afterAll(async () => {
    await worker.finish();
  });

  test('.type throws error if it is not defined', async () => {
    await expect(() => Worker.type).toThrow();
  });

  test('start() throws error if type is not defined', async () => {
    expect.assertions(1);

    await expect(worker.start()).rejects.toThrow(
      new Error('Worker type is not defined! Implement `static get type()` function.')
    );
  });

  test('handle() throws error if it is not implemented', async () => {
    expect.assertions(1);

    try {
      await worker.handle({content: Buffer.from('test')});
    } catch (e) {
      expect(e).toEqual(new Error('Unimplemented'));
    }
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

  it('consumes messages', async () => {
    await worker.start();

    // Sleep, let the worker consume message
    await sleep(1000);

    expect(consumed).toBe(true);
  });

  it('disconnects from server', async () => {
    await expect(worker.disconnect()).resolves.not.toThrowError();
    expect(worker.connected).toBe(false);
  });
});
