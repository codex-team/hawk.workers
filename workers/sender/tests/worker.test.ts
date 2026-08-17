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
      whatToReceive: WhatToReceive.SeenMore,
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
  timestamp: Date.now(),
  payload: {
    title: 'New event',
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
  const SenderWorker = require('../src').default;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ChannelSenderWorker = require('../src/channel-sender').default;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ExampleProvider = require('./provider-example').default;

  /**
   * Creates a single-channel worker with mocked db controllers and example provider
   */
  const createChannelWorker = (): any => {
    return new ChannelSenderWorker(
      'console' as any,
      new ExampleProvider(),
      new MockDBController() as any,
      new MockDBController() as any
    );
  };

  /**
   * Check worker type
   */
  it('should have correct worker type', () => {
    const worker = new SenderWorker();

    expect(worker.type).toBe('sender');
  });

  /**
   * Each channel worker should consume its own `sender/<channel>` queue
   */
  it('should create channel workers with correct types', () => {
    const worker = new SenderWorker();

    expect(worker.channelWorkers.length).toBeGreaterThan(0);
    worker.channelWorkers.forEach((channelWorker: any) => {
      expect(channelWorker.type).toMatch(/^sender\/[-a-z]+$/);
    });
  });

  /**
   * SENDER_CHANNELS controls the enabled channels
   */
  it('should respect SENDER_CHANNELS env variable', () => {
    process.env.SENDER_CHANNELS = 'telegram, slack';

    const worker = new SenderWorker();

    expect(worker.channelWorkers.map((channelWorker: any) => channelWorker.type)).toEqual(['sender/telegram', 'sender/slack']);

    process.env.SENDER_CHANNELS = 'smoke-signals';

    expect(() => new SenderWorker()).toThrow(/Unknown channels/);

    delete process.env.SENDER_CHANNELS;
  });

  /**
   * Check start and finish
   */
  it('should start and finish without errors', async () => {
    const worker = new SenderWorker();

    await worker.start();
    await worker.finish();
  });

  /**
   * All channels work through a single connection to Registry
   */
  it('should open one Registry connection for all channels', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const amqp = require('amqplib');

    amqp.connect.mockClear();

    const worker = new SenderWorker();

    await worker.start();

    expect(amqp.connect).toHaveBeenCalledTimes(1);

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
      const worker = new SenderWorker();

      await worker.start();

      const EXPECTED_CALLS_NUMBER = 2;

      expect(dbConnectMock).toHaveBeenCalledTimes(EXPECTED_CALLS_NUMBER);

      await worker.finish();
    });

    /**
     * On 'handle' it should get Project from DB
     */
    it('should query project on handle', async () => {
      const worker = createChannelWorker();

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
      const worker = createChannelWorker();

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
      const worker = createChannelWorker();

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

  describe('provider.send awaiting', () => {
    /**
     * Without await, handle() resolves even if send() rejects —
     * message would be acked and the error lost.
     * The .catch on the rejected promise only prevents an unhandledRejection
     * crash in the fire-and-forget case; await still observes the rejection.
     */
    it('should reject handle when provider.send fails', async () => {
      const worker = createChannelWorker();
      const sendError = new Error('provider send failed');

      (worker as any).provider.send = jest.fn(() => {
        const sendPromise = Promise.reject(sendError);

        sendPromise.catch(() => undefined);

        return sendPromise;
      });

      await expect(worker.handle({
        type: 'sign-up',
        payload: {
          password: 'secret',
          endpoint: 'user@example.com',
        },
      })).rejects.toThrow('provider send failed');
    });
  });
});
