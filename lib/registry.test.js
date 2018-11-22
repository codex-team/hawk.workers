const path = require('path');
const Redis = require('ioredis');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { Registry } = require('./registry');

// Url to redis databse with user,password,host and port
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

describe('Registry', () => {
  // Database connection
  let db;
  // Test task
  const task = {
    type: 'test',
    args: ['test', 'io']
  };

  // Test worker name
  const workerName = 'test';

  // Registry
  let registry;

  // Create redis connection and registry
  beforeAll(() => {
    db = new Redis(REDIS_URL);
    registry = new Registry();
  });

  // Close all connections
  afterAll(async () => {
    await db.quit();
    await registry.queueConfig.dbClient.quit();
  });

  it('should push task to worker', async () => {
    try {
      // Send message via queue
      await registry.pushTask(workerName, task);
      // Receive it via plain connection
      const response = await db.lindex(workerName, 0);

      expect(JSON.parse(response)).toEqual(task);
    } catch (e) {
      console.error(e);
      return e;
    }
  });

  it('should pop task for worker', async () => {
    try {
      // Pop task from registry
      const received = await registry.popTask(workerName);

      expect(received).toEqual(task);
    } catch (e) {
      console.error(e);
      return e;
    }
  });
});
