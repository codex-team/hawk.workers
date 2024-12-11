import { ObjectID } from 'mongodb';
import { WhatToReceive } from '../src/validator';
import * as messageMock from './mock.json';
import '../../../env-test';
import waitForExpect from 'wait-for-expect';

/* eslint-disable @typescript-eslint/no-explicit-any */

const rule = {
  _id: 'ruleid',
  isEnabled: true,
  uidAdded: 'userid',
  whatToReceive: WhatToReceive.All,
  including: [],
  excluding: [],
  channels: {
    telegram: {
      isEnabled: true,
      endpoint: 'tgEndpoint',
    },
    slack: {
      isEnabled: true,
      endpoint: 'slackEndpoint',
    },
    email: {
      isEnabled: false,
      endpoint: 'emailEndpoint',
    },
  },
} as any;

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

      await worker.start();

      const message = { ...messageMock };

      worker.sendToSenderWorker = jest.fn();

      await worker.handle(message);

      expect(dbConnectionMock).toBeCalled();

      await worker.finish();
    });

    it('should get db connection on message handle and cache result', async () => {
      const worker = new NotifierWorker();

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

      await worker.start();

      worker.sendToSenderWorker = jest.fn();

      await worker.handle(message);

      expect(dbCollectionMock).toBeCalledWith('projects');

      await worker.finish();
    });

    it('should query correct project on message handle', async () => {
      const worker = new NotifierWorker();
      const message = { ...messageMock };

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
    it('should not send task to sender workers if event is not new and repetitions today not equal to threshold', async () => {
      const worker = new NotifierWorker();

      await worker.start();

      const message = { ...messageMock };
      const event = { ...message.event };
      event.isNew = false;

      worker.redis.getEventRepetitionsFromDigest = jest.fn(async (_projectId, _groupHash) => {
        return Promise.resolve(1);
      });

      worker.redis.getProjectNotificationThreshold = jest.fn(async (_projectId) => {
        return Promise.resolve(10);
      });

      worker.sendToSenderWorker = jest.fn();

      worker.handle(message);

      /**
       * Check that we haven't sent any tasks to sender worker
       * because event repetitions today are less than threshold
       */
      expect(worker.sendToSenderWorker).not.toBeCalled();

      worker.redis.getEventRepetitionsFromDigest = jest.fn(async (_projectId, _groupHash) => {
        return Promise.resolve(100);
      });

      worker.handle(message);

      /**
       * Check that we haven't sent any tasks to sender worker
       * because event repetitions today are more than threshold
       */
      expect(worker.sendToSenderWorker).not.toBeCalled();

      await worker.finish();
    });

    it('should send task to sender workers if event is new', async () => {
      const worker = new NotifierWorker();

      await worker.start();

      const message = { ...messageMock };
      const event = { ...message.event };

      event.isNew = true;

      worker.sendToSenderWorker = jest.fn();

      worker.handle(message);

      expect(worker.sendToSenderWorker).toBeCalled();

      await worker.finish();
    });

    it('should send task to sender workers if event repetitions today equal to threshold', async () => {
      const worker = new NotifierWorker();

      await worker.start();

      const message = { ...messageMock };
      const event = { ...message.event };
      event.isNew = false;

      worker.redis.getEventRepetitionsFromDigest = jest.fn(async (_projectId, _groupHash) => {
        return Promise.resolve(10);
      });

      worker.redis.getProjectNotificationThreshold = jest.fn(async (_projectId) => {
        return Promise.resolve(10);
      });

      worker.sendToSenderWorker = jest.fn();

      worker.handle(message);

      expect(worker.sendToSenderWorker).toBeCalled();

      await worker.finish();
    });

    it('should not call events database for threshold calculation if threshold stored in redis', async () => {
      const worker = new NotifierWorker();

      await worker.start();

      /**
       * Mock of the function that returns 
       */
      worker.redis.getEventRepetitionsFromDigest = jest.fn(async (_projectId, _groupHash) => {
        return Promise.resolve(1);
      });

      worker.redis.getProjectNotificationThreshold(async (_projectId) => {
        return Promise.resolve(1);
      })

      worker.eventsDb.getConnection = jest.fn();

      const message = { ...messageMock };

      await worker.handle(message);

      /**
       * It should not be called beacuse event repetitions got from redis
       */
      expect(worker.eventsDb.getConnection).not.toBeCalled;

      await worker.finish();
    });

    it('should calculate notification threshold using events db if redis has no threshold', async () => {
      const worker = new NotifierWorker();

      await worker.start();

      worker.redis.getProjectNotificationThreshold = jest.fn(async (_projectId, _groupHash) => {
        return Promise.resolve(null);
      });

      worker.eventsDb.getConnection = jest.fn();
      worker.redis.setProjectNotificationTreshold = jest.fn();
      
      /**
       * Check that we connected to the events database to calculate the threshold
       */
      expect(worker.eventsDb.getConnection).toBeCalled();

      /**
       * Check that we stored calculated threshold in redis
       */
      expect(worker.redis.setProjectNotificationTreshold).toBeCalled();

      await worker.finish();
    })

    it('should always add event to redis digest', async () => {
      const worker = new NotifierWorker();

      await worker.start();

      const message = { ...messageMock };

      worker.redis.addEventToDigest = jest.fn();

      worker.handle(message);

      expect(worker.redis.addEventToDigest).toBeCalled();

      await worker.finish();
    });
  });
});
