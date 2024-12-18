import { ObjectID } from 'mongodb';
import { WhatToReceive } from '../src/validator';
import * as messageMock from './mock.json';
import '../../../env-test';
import RedisHelper from '../src/redisHelper';

/* eslint-disable @typescript-eslint/no-explicit-any */

const rule = {
  _id: 'ruleid',
  isEnabled: true,
  uidAdded: 'userid',
  whatToReceive: WhatToReceive.All,
  threshold: 100,
  thresholdPeriod: 60 * 1000,
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

const dbQueryMock = jest.fn(() => ({
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
  jest.mock('../../../lib/db/controller', () => ({
    DatabaseController: MockDBController,
  }));

  /**
   * Reset calls number after each test
   */
  afterEach(() => {
    jest.clearAllMocks();
  });

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const NotifierWorker = require('../src').default;

  it('should have correct worker type', () => {
    const worker = new NotifierWorker();

    expect(worker.type).toEqual('notifier');
  });

  it('should start and finish without errors', async () => {
    const worker = new NotifierWorker();

    await worker.start();
    await worker.finish();
  });

  describe('db calls', () => {
    it('should connect to db on start', async () => {
      const worker = new NotifierWorker();

      await worker.start();

      expect(dbConnectMock).toBeCalled();

      await worker.finish();
    });

    it('should get db connection on message handle', async () => {
      const worker = new NotifierWorker();

      worker.redis.redisClient.eval = jest.fn(async () => {
        return Promise.resolve();
      });

      await worker.start();

      const message = { ...messageMock };

      worker.sendToSenderWorker = jest.fn();

      await worker.handle(message);

      expect(dbConnectionMock).toBeCalled();

      await worker.finish();
    });

    it('should get db connection on message handle and cache result', async () => {
      const worker = new NotifierWorker();

      worker.redis.redisClient.eval = jest.fn(async () => {
        return Promise.resolve();
      });

      await worker.start();

      const message = { ...messageMock };

      worker.sendToSenderWorker = jest.fn();

      await worker.handle(message);
      await worker.handle(message);
      await worker.handle(message);
      await worker.handle(message);
      await worker.handle(message);

      expect(dbConnectionMock).toBeCalledTimes(1);

      await worker.finish();
    });

    it('should query correct collection on message handle', async () => {
      const worker = new NotifierWorker();
      const message = { ...messageMock };

      worker.redis.redisClient.eval = jest.fn(async () => {
        return Promise.resolve();
      });

      await worker.start();

      worker.sendToSenderWorker = jest.fn();

      await worker.handle(message);

      expect(dbCollectionMock).toBeCalledWith('projects');

      await worker.finish();
    });

    it('should query correct project on message handle', async () => {
      const worker = new NotifierWorker();
      const message = { ...messageMock };

      worker.redis.redisClient.eval = jest.fn(async () => {
        return Promise.resolve();
      });

      await worker.start();

      worker.sendToSenderWorker = jest.fn();

      await worker.handle(message);

      expect(dbQueryMock).toBeCalledWith({ _id: new ObjectID(message.projectId) });

      await worker.finish();
    });

    it('should close db connection on finish', async () => {
      const worker = new NotifierWorker();

      await worker.start();

      worker.sendToSenderWorker = jest.fn();

      await worker.finish();

      expect(dbCloseMock).toBeCalled();

      await worker.finish();
    });
  });

  describe('handling', () => {
    it('should send task if event threshold reached', async () => {
      const worker = new NotifierWorker();

      jest.mock('../src/redisHelper');

      worker.redis.redisClient.eval = jest.fn(async () => {
        return Promise.resolve();
      });

      await worker.start();

      const message = { ...messageMock };

      /**
       * Current event count is equal to rule threshold
       */
      RedisHelper.prototype.computeEventCountForPeriod = jest.fn(async () => {
        return Promise.resolve(rule.threshold);
      });

      worker.sendToSenderWorker = jest.fn();

      await worker.handle(message);

      expect(worker.sendToSenderWorker).toHaveBeenCalled();

      await worker.finish();
    });

    it('should not send task if event repetitions number is less than threshold', async () => {
      const worker = new NotifierWorker();

      jest.mock('../src/redisHelper');

      worker.redis.redisClient.eval = jest.fn(async () => {
        return Promise.resolve();
      });

      await worker.start();

      const message = { ...messageMock };

      /**
       * Current event count is equal to rule threshold
       */
      RedisHelper.prototype.computeEventCountForPeriod = jest.fn(async () => {
        return Promise.resolve(rule.threshold - 1);
      });

      worker.sendToSenderWorker = jest.fn();

      await worker.handle(message);

      expect(worker.sendToSenderWorker).not.toHaveBeenCalled();

      await worker.finish();
    });

    it('should not send task if event repetitions number is more than threshold', async () => {
      const worker = new NotifierWorker();

      jest.mock('../src/redisHelper');

      worker.redis.redisClient.eval = jest.fn(async () => {
        return Promise.resolve();
      });

      await worker.start();

      const message = { ...messageMock };

      /**
       * Current event count is equal to rule threshold
       */
      RedisHelper.prototype.computeEventCountForPeriod = jest.fn(async () => {
        return Promise.resolve(rule.threshold + 1);
      });

      worker.sendToSenderWorker = jest.fn();

      await worker.handle(message);
      await worker.handle(message);

      expect(worker.sendToSenderWorker).not.toHaveBeenCalled();

      await worker.finish();
    });
  });
});
