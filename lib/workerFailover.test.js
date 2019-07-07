const path = require('path');
const amqp = require('amqplib');

const { Worker, NonCriticalError, CriticalError } = require('./worker');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

/**
 * Test worker type
 */
const WORKER_TYPE = 'errors/nodejs';

/**
 * Stash queue name
 */
const STASH_QUEUE = 'stash/nodejs';

/**
 * Unique id to differenciate message
 */
const UID = parseInt(Math.random() * 100);

const TEST_MSG = JSON.stringify({
  message: `ReferenceError: nonexistant_func${UID} is not defined`,
  type: 'ReferenceError',
  stack: `ReferenceError: nonexistant_func${UID} is not defined\n    at namedFunc (/home/nick/stuff/hawk.workers/tools/nodejs/bomber.js:42:7)\n    at main (/home/nick/stuff/hawk.workers/tools/nodejs/bomber.js:64:5)\n    at Object.\u003canonymous\u003e (/home/nick/stuff/hawk.workers/tools/nodejs/bomber.js:74:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)\n    at Function.Module._load (internal/modules/cjs/loader.js:558:3)\n    at Function.Module.runMain (internal/modules/cjs/loader.js:797:12)\n    at executeUserCode (internal/bootstrap/node.js:526:15)`,
  time: new Date().toISOString(),
  context: 'Exception in namedFunc'
});

let consumed = false;

/**
 * Async sleep
 *
 * @param {number} ms
 * @returns Promise
 */
const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Test base worker class
 *
 * @class TestWorker
 * @extends {Worker}
 */
class TestWorker extends Worker {
  /**
   *
   *
   * @readonly
   * @memberof TestWorker
   */
  get type() {
    return WORKER_TYPE;
  }
}

/**
 * Worker class for testing stash
 *
 * @class StashTestWorker
 * @extends {TestWorker}
 */
class StashTestWorker extends TestWorker {
  /**
   * Message handle function
   *
   * @param {Object} msg Message object from consume method
   * @param {Buffer} msg.content Message content
   * @memberof StashTestWorker
   */
  async handle(msg) {
    if (msg) {
      // Show jest that we consumed a message
      consumed = true;

      // Unsubscribe since we want to receive only one message
      this.unsubscribe();

      // Trow NonCriticalError to make `processMessage` send our message to stash
      throw new NonCriticalError('Test Noncritical failure');
    }
  }
}

/**
 * Worker class for testing requeueing
 *
 * @class RequeueTestWorker
 * @extends {TestWorker}
 */
class RequeueTestWorker extends TestWorker {
  /**
   * Message handle function
   *
   * @param {Object} msg Message object from consume method
   * @param {Buffer} msg.content Message content
   * @memberof RequeueTestWorker
   */
  async handle(msg) {
    if (msg) {
      // Show jest that we consumed a message
      consumed = true;

      // Unsubscribe since we want to receive only one message
      this.unsubscribe();

      // Throw CriticalError to make `processMessage` requeue our message
      throw new CriticalError('Test critical failure');
    }
  }
}

describe('Worker failover', () => {
  let conn;
  let channel;

  let worker;

  /**
   * Make connection to Registry first
   **/
  beforeAll(async () => {
    conn = await amqp.connect(process.env.REGISTRY_URL);
    channel = await conn.createChannel();

    await channel.assertQueue(WORKER_TYPE);
  });

  /**
   * Before each test set `consumed` to false
   * and publish test message
   */
  beforeEach(async () => {
    consumed = false;
    channel.publish('errors', WORKER_TYPE, Buffer.from(TEST_MSG));
  });

  afterEach(async () => {
    await worker.finish();
  });
  /**
   * Close all connections after tests
   */
  afterAll(async () => {
    await channel.close();
    await conn.close();
  });

  it('sends message to stash', async () => {
    worker = new StashTestWorker();
    await worker.start();

    await sleep(1000);

    const received = await channel.get(STASH_QUEUE, { noAck: true });

    await expect(consumed).toBe(true);
    await expect(received).toMatchObject({
      content: Buffer.from(TEST_MSG)
    });
  });

  it('requeues message', async () => {
    worker = new RequeueTestWorker();
    await worker.start();

    await sleep(1000);

    const received = await channel.get(WORKER_TYPE, { noAck: true });

    await expect(consumed).toBe(true);
    await expect(received).toMatchObject({
      content: Buffer.from(TEST_MSG)
    });
  });
});