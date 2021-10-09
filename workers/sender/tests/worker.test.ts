import { GroupedEventDBScheme } from '@hawk.so/types';
import { WhatToReceive } from 'hawk-worker-notifier/src/validator';
import { ObjectId } from 'mongodb';
import '../../../env-test';
import dotenv from 'dotenv';
import path from 'path';

/**
 * Load local environment configuration
 */
const testEnv = dotenv.config({ path: path.resolve(__dirname, '../.env.test') }).parsed;

Object.assign(process.env, testEnv);

/* eslint-disable @typescript-eslint/no-explicit-any */

const projectQueryMock = jest.fn(() => ({
  _id: new ObjectId('5e3eef0679fa3700a0198a49'),
  name: 'Project',
  notifications: [
    {
      _id: new ObjectId('5e3eef0679fa3700a0198a49'),
      isEnabled: true,
      uidAdded: new ObjectId('5e3eef0679fa3700a0198a49'),
      whatToReceive: WhatToReceive.All,
      including: [],
      excluding: [],
      channels: {
        /**
         * Channel of test sender
         */
        console: {
          isEnabled: true,
          endpoint: 'current-terminal-window',
          minPeriod: 0.5,
        },

        /**
         * Used in app channels
         */
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
    },
  ],
}));

const eventsQueryMock = jest.fn(() => ({
  totalCount: 10,
  payload: {
    title: 'New event',
    timestamp: Date.now(),
    backtrace: [ {
      file: 'file',
      line: 1,
      sourceCode: [ {
        line: 1,
        content: 'code',
      } ],
    } ],
  },
} as GroupedEventDBScheme));
const dailyEventsQueryMock = jest.fn(() => 1);

const dbCollectionMock = jest.fn((collection: string) => {
  switch (true) {
    case collection === 'project':
      return {
        findOne: projectQueryMock,
      };

    case collection.startsWith('events'):
      return {
        findOne: eventsQueryMock,
      };

    case collection.startsWith('dailyEvents'):
      return {
        countDocuments: dailyEventsQueryMock,
      };
  }

  return ({
    findOne: projectQueryMock,
    countDocuments: projectQueryMock,
  });
});

const dbConnectionMock = jest.fn(() => {
  return {
    collection: dbCollectionMock,
  };
});

const dbConnectMock = jest.fn();
const dbCloseMock = jest.fn();

/**
 * Mock
 */
class MockDBController {
  /**
   * Mock
   *
   * @param args - connection args
   */
  public connect(...args): any {
    return dbConnectMock(...args);
  }

  /**
   * Mock
   */
  public getConnection(): any {
    return dbConnectionMock();
  }

  /**
   * Mock
   */
  public close(): any {
    dbCloseMock();
  }
}

describe('Sender Worker', () => {
  /**
   * Mock db controller
   */
  jest.mock('../../../lib/db/controller', () => ({
    DatabaseController: MockDBController,
  }));

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ExampleSenderWorker = require('./sender-example').default;

  /**
   * Check worker type
   */
  it('should have correct worker type', () => {
    const worker = new ExampleSenderWorker();

    expect(worker.type).toMatch(/^sender\/[-a-z]+$/);
  });

  /**
   * Check start and finish
   */
  it('should start and finish without errors', async () => {
    const worker = new ExampleSenderWorker();

    await worker.start();
    await worker.finish();
  });

  /**
   * Check DB connect
   */
  describe('db calls', () => {
    /**
     * Call connect to 2 DBs per single time
     */
    it('should connect to db on start', async () => {
      dbConnectMock.mockClear();
      const worker = new ExampleSenderWorker();

      await worker.start();

      const EXPECTED_CALLS_NUMBER = 2;

      expect(dbConnectMock).toHaveBeenCalledTimes(EXPECTED_CALLS_NUMBER);

      await worker.finish();
    });

    /**
     * On 'handle' it should get Project from DB
     */
    it('should query project on handle', async () => {
      const worker = new ExampleSenderWorker();

      await worker.handle({
        type: 'event',
        payload: {
          projectId: '5e3eef0679fa3700a0198a49',
          ruleId: '5e3eef0679fa3700a0198a49',
          events: [ {
            key: 'groupHash',
            count: 1,
          } ],
        },
      });

      expect(projectQueryMock).toBeCalledWith({ _id: new ObjectId('5e3eef0679fa3700a0198a49') });
    });

    /**
     * Then, it should get events
     */
    it('should query events on handle', async () => {
      const worker = new ExampleSenderWorker();

      await worker.handle({
        type: 'event',
        payload: {
          projectId: '5e3eef0679fa3700a0198a49',
          ruleId: '5e3eef0679fa3700a0198a49',
          events: [ {
            key: 'groupHash',
            count: 1,
          } ],
        },
      });

      expect(eventsQueryMock).toBeCalledWith({ groupHash: 'groupHash' });
    });

    /**
     * Then, compute events count
     */
    it('should query daily events count on handle', async () => {
      const worker = new ExampleSenderWorker();

      await worker.handle({
        type: 'event',
        payload: {
          projectId: '5e3eef0679fa3700a0198a49',
          ruleId: '5e3eef0679fa3700a0198a49',
          events: [ {
            key: 'groupHash',
            count: 1,
          } ],
        },
      });

      expect(dailyEventsQueryMock).toBeCalledWith({ groupHash: 'groupHash' });
    });
  });
});
