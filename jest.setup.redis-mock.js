const { GenericContainer } = require('testcontainers');

let redisTestContainer;

/**
 * Create test container with Redis, which could be used in tests
 */
beforeAll(async () => {
  redisTestContainer = await new GenericContainer('redis')
    .withExposedPorts(6379)
    .start();

  const port = redisTestContainer.getMappedPort(6379);
  const host = redisTestContainer.getHost();

  /**
   * Set environment variable for redisHelper to connect to redis container
   */
  process.env.REDIS_URL = `redis://${host}:${port}`;
}
);

afterAll(async () => {
  if (redisTestContainer) {
    try {
      await redisTestContainer.stop();
    } catch (error) {
      // Ignore errors when stopping container
      // Container might already be stopped or not started
    }
  }

  /**
   * Clear REDIS_URL to prevent further connection attempts
   */
  delete process.env.REDIS_URL;
}, 30000);
