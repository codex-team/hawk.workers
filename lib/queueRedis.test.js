const Redis = require('ioredis');
const { QueueFactory } = require('./queueFactory');

// Url to redis databse with user,password,host and port
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
// Name of testing queue
const QUEUE_NAME = 'test';
// Timeout for queue
const QUEUE_TIMEOUT = 30;

describe('RedisQueue', () => {
  // Database connection
  let db;
  // Test message
  const message = {
    type: 'test',
    args: ['test', 'io']
  };
  // Queue
  let queue;

  // Create redis connection and queue
  beforeAll(() => {
    db = new Redis(REDIS_URL);
    queue = QueueFactory.create('redis', {
      queueName: QUEUE_NAME,
      timeout: QUEUE_TIMEOUT,
      dbClient: db
    });
  });

  // Close all connections
  afterAll(() => {
    db.quit();
  });

  // Send message via queue and check it via another connection
  it('should send a message to queue', async () => {
    try {
      // Send message via queue
      await queue.push(message);
      // Receive it via plain connection
      const response = await db.lindex(QUEUE_NAME, 0);

      expect(JSON.parse(response)).toEqual(message);
    } catch (e) {
      console.error(e);
      return e;
    }
  });

  // Pop created message from Redis queue
  it('should receive a message from the queue', async () => {
    try {
      const received = await queue.pop();

      expect(received).toEqual(message);
    } catch (e) {
      console.error(e);
      return e;
    }
  });
});
