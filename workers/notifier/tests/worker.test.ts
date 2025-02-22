import { ObjectID } from 'mongodb';
import { WhatToReceive } from '../src/validator';
import * as messageMock from './mock.json';
import '../../../env-test';
import RedisHelper from '../src/redisHelper';
import { createClient, RedisClientType } from 'redis';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Determine the threshold for the rule
 */
const threshold = 100;

/**
 * Determine the threshold period for the rule
 */
const thresholdPeriod = 60 * 1000;

const rule = {
  _id: 'ruleid',
  isEnabled: true,
  uidAdded: 'userid',
  whatToReceive: WhatToReceive.SeenMore,
  threshold: threshold,
  thresholdPeriod: thresholdPeriod,
  including: [],
  excluding: [],
  channels: {
    telegram: {
      isEnabled: true,
      endpoint: 'tgEndpoint',
      minPeriod: 0.5,
    },
    slack: {
      isEnabled: true,
      endpoint: 'slackEndpoint',
      minPeriod: 0.5,
    },
    email: {
      isEnabled: false,
      endpoint: 'emailEndpoint',
      minPeriod: 0.5,
    },
  },
} as any;

const alternativeRule = {
  _id: 'alternativeRuleId',
  isEnabled: true,
  uidAdded: 'userid',
  whatToReceive: WhatToReceive.SeenMore,
  threshold: threshold * 2,
  thresholdPeriod: thresholdPeriod * 2,
  including: [],
  excluding: [],
  channels: {
    telegram: {
      isEnabled: true,
      endpoint: 'telegramEndpoint',
      minPeriod: 0.5,
    },
    slack: {
      isEnabled: false,
      endpoint: 'slackEndpoint',
      minPeriod: 0.5,
    },
    email: {
      isEnabled: false,
      endpoint: 'emailEndpoint',
      minPeriod: 0.5,
    },
  },
};

/**
 * Save originl RedisHelper prototype to restore it after each test
 */
const originalRedisHelperPrototype = Object.getOwnPropertyDescriptors(RedisHelper.prototype);

let dbQueryMock = jest.fn(() => ({
  notifications: [ rule ],
})) as any;

const dbCollectionMock = jest.fn(() => {
  return {
    findOne: dbQueryMock,
  };
});

const dbConnectionMock = jest.fn(() => {
  return {
    collection: dbCollectionMock,
  };
});

const dbConnectMock = jest.fn();
const dbCloseMock = jest.fn();

/**
 * DBController mock
 */
class MockDBController {
  /**
   * DBController.connect method mock
   *
   * @param args - connect arguments
   */
  public connect(...args: any[]): any {
    return dbConnectMock(...args);
  }

  /**
   * DBController.getConnection method mock
   */
  public getConnection(): any {
    return dbConnectionMock();
  }

  /**
   * DBController.close method mock
   */
  public close(): void {
    dbCloseMock();
  }
}

describe('NotifierWorker', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const NotifierWorker = require('../src').default;
  let redisClient: RedisClientType;

  let worker: typeof NotifierWorker;

  jest.mock('../../../lib/db/controller', () => ({
    DatabaseController: MockDBController,
  }));

  // Before all tests connect to redis client
  beforeAll(async () => {
    redisClient = createClient({ url: process.env.REDIS_URL });

    jest.mock('../src/redisHelper');

    await redisClient.connect();
  });

  /**
   * Before each test create an instance of the worker and start it
   */
  beforeEach(async () => {
    jest.clearAllMocks();

    /**
     * Restore original RedisHelper prototype after possible changes
     */
    Object.defineProperties(RedisHelper.prototype, originalRedisHelperPrototype);

    worker = new NotifierWorker();

    /**
     * Reset information that could be patched by tets Arrangement
     */
    rule.whatToReceive = WhatToReceive.SeenMore;
    rule.isEnabled = true;
    rule.including = [];
    rule.excluding = [];

    dbQueryMock = jest.fn(() => ({
      notifications: [ rule ],
    })) as any;

    await redisClient.flushAll();

    await worker.start();
  });

  /**
   * Reset calls number after each test
   */
  afterEach(async () => {
    await worker.finish();
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  describe('db calls', () => {
    it('should connect to db on start', async () => {
      expect(dbConnectMock).toBeCalled();
    });

    it('should get db connection on message handle', async () => {
      const message = { ...messageMock };

      worker.sendToSenderWorker = jest.fn();

      await worker.handle(message);

      expect(dbConnectionMock).toBeCalled();
    });

    it('should get db connection on message handle and cache result', async () => {
      const message = { ...messageMock };

      worker.sendToSenderWorker = jest.fn();

      await worker.handle(message);
      await worker.handle(message);
      await worker.handle(message);
      await worker.handle(message);
      await worker.handle(message);

      expect(dbConnectionMock).toBeCalledTimes(1);
    });

    it('should query correct collection on message handle', async () => {
      const message = { ...messageMock };

      worker.sendToSenderWorker = jest.fn();

      await worker.handle(message);

      expect(dbCollectionMock).toBeCalledWith('projects');
    });

    it('should query correct project on message handle', async () => {
      const message = { ...messageMock };

      worker.sendToSenderWorker = jest.fn();

      await worker.handle(message);

      expect(dbQueryMock).toBeCalledWith({ _id: new ObjectID(message.projectId) });
    });

    it('should close db connection on finish', async () => {
      worker.sendToSenderWorker = jest.fn();

      await worker.finish();

      expect(dbCloseMock).toBeCalled();
    });
  });

  describe('worker functionality', () => {
    it('should send event to channels once if event is new and rule.whatToReceive is ONLY_NEW', async () => {
      rule.whatToReceive = WhatToReceive.New;

      worker.sendEventsToChannels = jest.fn();

      const message = { ...messageMock };

      message.event.isNew = true;

      await worker.handle(message);

      message.event.isNew = false;
      await worker.handle(message);

      expect(worker.sendEventsToChannels).toBeCalledTimes(1);
    });

    it('should add task to sender worker if event threshold reached', async () => {
      /**
       * Simulate case when we reached threshold in redis.
       */
      RedisHelper.prototype.computeEventCountForPeriod = jest.fn(async () => threshold);

      const message = { ...messageMock };

      worker.sendToSenderWorker = jest.fn();

      await worker.handle(message);

      expect(worker.sendToSenderWorker).toHaveBeenCalled();
    });

    it('should not add task to sender worker if event count is more than event threshold', async () => {
      /**
       * Simulate case when threshold in redis is more than rule threshold.
       */
      RedisHelper.prototype.computeEventCountForPeriod = jest.fn(async () => threshold + 1);

      worker.sendToSenderWorker = jest.fn();

      const message = { ...messageMock };

      await worker.handle(message);

      expect(worker.sendToSenderWorker).not.toHaveBeenCalled();
    });

    it('should not add task to sender worker if event count is less than event threshold', async () => {
      /**
       * Simulate case then threshold in redis is less than rule threshold
       */
      RedisHelper.prototype.computeEventCountForPeriod = jest.fn(async () => threshold - 1);

      worker.sendToSenderWorker = jest.fn();

      const message = { ...messageMock };

      await worker.handle(message);

      expect(worker.sendToSenderWorker).not.toHaveBeenCalled();
    });

    it('should not check for event count and should not send event to sender if rule is disabled', async () => {
      RedisHelper.prototype.computeEventCountForPeriod = jest.fn();

      worker.sendToSenderWorker = jest.fn();

      rule.isEnabled = false;
      const message = { ...messageMock };

      await worker.handle(message);

      expect(RedisHelper.prototype.computeEventCountForPeriod).not.toHaveBeenCalled();
      expect(worker.sendToSenderWorker).not.toHaveBeenCalled();
    });

    it('should not check for event count and should not send event to sender if rule validation did not pass', async () => {
      RedisHelper.prototype.computeEventCountForPeriod = jest.fn();

      worker.sendToSenderWorker = jest.fn();

      rule.including = [ 'some string that is not in message' ];
      const message = { ...messageMock };

      await worker.handle(message);

      expect(RedisHelper.prototype.computeEventCountForPeriod).not.toHaveBeenCalled();
      expect(worker.sendToSenderWorker).not.toHaveBeenCalled();
    });

    it('should send event to all channels that are enabled in rule', async () => {
      /**
       * Simulate case when we reached threshold in redis.
       */
      RedisHelper.prototype.computeEventCountForPeriod = jest.fn(async () => threshold);

      worker.sendToSenderWorker = jest.fn();

      const message = { ...messageMock };

      rule.channels = {
        telegram: {
          isEnabled: true,
          endpoint: 'tgEndpoint',
          minPeriod: 0.5,
        },
        slack: {
          isEnabled: true,
          endpoint: 'slackEndpoint',
          minPeriod: 0.5,
        },
        email: {
          isEnabled: false,
          endpoint: 'emailEndpoint',
          minPeriod: 0.5,
        },
      };

      await worker.handle(message);

      expect(worker.sendToSenderWorker).toBeCalledTimes(2);
    });

    it('should compute event count for period for each fitted rule', async () => {
      /**
       * Simulate case when there are two rules for the event in database.
       */
      dbQueryMock = jest.fn(() => ({
        notifications: [rule, alternativeRule],
      })) as any;

      jest.mock('../../../lib/db/controller', () => ({
        DatabaseController: MockDBController,
      }));

      /**
       * Since we mocked database in test, we need to restart worker, for it to use new database mock
       */
      await worker.finish();
      await worker.start();

      RedisHelper.prototype.computeEventCountForPeriod = jest.fn();

      const message = { ...messageMock };

      await worker.handle(message);

      expect(RedisHelper.prototype.computeEventCountForPeriod).toHaveBeenCalledTimes(2);
    });

    it('should send event to channels at most once in one threshold period for one fitted rule, if worker received more than threshold events', async () => {
      worker.sendEventsToChannels = jest.fn();

      const message = { ...messageMock };

      for (let i = 0; i < 1_000; i++) {
        await worker.handle(message);
      }

      expect(worker.sendEventsToChannels).toBeCalledTimes(1);
    });
  });
});
