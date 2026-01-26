const { GenericContainer } = require('testcontainers');

let redisTestContainer;

/**
 * Create test container with Redis, which could be used in tests
 */
beforeAll(async () => {
  // redisTestContainer = await new GenericContainer('redis')
  //   .withExposedPorts(6379)
  //   .start();

  // const port = redisTestContainer.getMappedPort(6379);
  // const host = redisTestContainer.getHost();

  // /**
  //  * Set environment variable for redisHelper to connect to redis container
  //  */
  // process.env.REDIS_URL = `redis://${host}:${port}`;
}
);

afterAll(async () => {
  // await redisTestContainer.stop();
});
