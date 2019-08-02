const amqp = require('amqplib');
const { sleep } = require('./utils');
const { Worker, NonCriticalError } = require('./worker');

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
const UID = Math.floor(Math.random() * 100);

const TEST_MSG = JSON.stringify({
  message: `ReferenceError: nonexistant_func${UID} is not defined`,
  type: 'ReferenceError',
  stack: `ReferenceError: nonexistant_func${UID} is not defined\n    at namedFunc (/home/nick/stuff/hawk.workers/tools/nodejs/bomber.js:42:7)\n    at main (/home/nick/stuff/hawk.workers/tools/nodejs/bomber.js:64:5)\n    at Object.\u003canonymous\u003e (/home/nick/stuff/hawk.workers/tools/nodejs/bomber.js:74:1)\n    at Module._compile (internal/modules/cjs/loader.js:734:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:745:10)\n    at Module.load (internal/modules/cjs/loader.js:626:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:566:12)\n    at Function.Module._load (internal/modules/cjs/loader.js:558:3)\n    at Function.Module.runMain (internal/modules/cjs/loader.js:797:12)\n    at executeUserCode (internal/bootstrap/node.js:526:15)`,
  time: new Date().toISOString(),
  context: 'Exception in namedFunc'
});

let consumed = false;

/**
 * Test base worker class
 * @abstract
 */
class TestWorker extends Worker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  static get type() {
    return WORKER_TYPE;
  }
}

/**
 * Worker class for testing stash
 */
class StashTestWorker extends TestWorker {
  /**
   * Message handle function
   *
   * @param {Object} msg Message object from consume method
   * @param {Buffer} msg.content Message content
   */
  static async handle(msg) {
    if (msg) {
      // Show jest that we consumed a message
      consumed = true;

      // Throw NonCriticalError to make `processMessage` send our message to stash
      throw new NonCriticalError('Test Noncritical failure');
    }
  }
}

describe('Worker failover', () => {
  let conn;
  let channel;

  let worker;

  /**
   * Make connection to Registry first
   *
   */
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

  test('sends message to stash', async () => {
    worker = new StashTestWorker();
    await worker.start();

    await sleep(1000);

    const received = await channel.get(STASH_QUEUE, { noAck: true });

    expect(consumed).toBe(true);
    expect(received.content.toString()).toEqual(TEST_MSG);
  });
});
