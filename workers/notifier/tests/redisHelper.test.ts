import RedisHelper from '../src/redisHelper';
import { createClient, RedisClientType } from 'redis';

describe('RedisHelper', () => {
  let redisHelper: RedisHelper;
  let redisClientMock: jest.Mocked<ReturnType<typeof createClient>>;
  let redisClient: RedisClientType;

  beforeAll(async () => {
    redisHelper = new RedisHelper();
    redisClient = createClient({ url: process.env.REDIS_URL });
    await redisClient.connect();
    redisClientMock = Reflect.get(redisHelper, 'redisClient') as jest.Mocked<ReturnType<typeof createClient>>;
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  describe('initialize', () => {
    it('should connect to redis client', async () => {
      const connect = jest.spyOn(redisClientMock, 'connect');

      await redisHelper.initialize();

      expect(connect).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close redis client', async () => {
      const quit = jest.spyOn(redisClientMock, 'quit');

      await redisHelper.close();

      expect(quit).toHaveBeenCalled();
    });

    it('should not throw error on close if client is already closed', async () => {
      const quit = jest.spyOn(redisClientMock, 'quit');

      quit.mockClear();

      await redisHelper.close();
      await redisHelper.close();
      await redisHelper.close();

      expect(quit).toHaveBeenCalledTimes(0);
    });
  });

  describe('computeEventCountForPeriod', () => {
    beforeEach(async () => {
      await redisHelper.initialize();
    });

    afterEach(async () => {
      await redisHelper.close();
    });

    it('should return event count', async () => {
      const ruleId = 'ruleId';
      const groupHash = 'groupHash';
      const thresholdPeriod = 1000;

      const currentEventCount = await redisHelper.computeEventCountForPeriod(ruleId, groupHash, thresholdPeriod);

      expect(currentEventCount).toBe(1);
    });

    it('should reset counter and timestamp if threshold period is expired', async () => {
      const ruleId = 'ruleId';
      const currentDate = Date.now();
      const groupHash = 'groupHash';
      const thresholdPeriod = 1000;

      /**
       * Send several events to increment counter
       */
      await redisHelper.computeEventCountForPeriod(ruleId, groupHash, thresholdPeriod);
      await redisHelper.computeEventCountForPeriod(ruleId, groupHash, thresholdPeriod);
      await redisHelper.computeEventCountForPeriod(ruleId, groupHash, thresholdPeriod);

      /**
       * Update current date for threshold period expiration
       */
      jest.spyOn(global.Date, 'now').mockImplementation(() => currentDate + 2 * thresholdPeriod + 1);

      const currentEventCount = await redisHelper.computeEventCountForPeriod(ruleId, groupHash, thresholdPeriod);
      const currentlyStoredTimestamp = await redisClient.hGet(`${ruleId}:${groupHash}:${thresholdPeriod}`, 'timestamp');

      expect(currentEventCount).toBe(1);
      expect(currentlyStoredTimestamp).toBe(Date.now().toString());
    });
  });
});
