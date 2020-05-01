import { GroupedEvent } from 'hawk-worker-grouper/types/grouped-event';
import { WhatToReceive } from 'hawk-worker-notifier/src/validator';
import { ObjectID } from 'mongodb';
import '../src/env';
import { Project } from 'hawk-worker-sender/types/project';

const projectQueryMock = jest.fn(() => ({
  _id: new ObjectID('5e3eef0679fa3700a0198a49'),
  name: 'Project',
  notifications: [
    {
      _id: new ObjectID('5e3eef0679fa3700a0198a49'),
      isEnabled: true,
      uidAdded: new ObjectID('5e3eef0679fa3700a0198a49'),
      whatToReceive: WhatToReceive.All,
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
} as GroupedEvent));
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
// eslint-disable-next-line @typescript-eslint/class-name-casing
class mockDBController {
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

describe('Email Sender Worker', () => {
  jest.mock('../../../lib/db/controller', () => ({
    DatabaseController: mockDBController,
  }));

  const EmailWorker = require('../src').default;

  it('should have correct worker type', () => {
    const worker = new EmailWorker();

    expect(worker.type).toEqual('sender/email');
  });

  it('should start and finish without errors', async () => {
    const worker = new EmailWorker();

    await worker.start();
    await worker.finish();
  });

  describe('db calls', () => {
    it('should connect to db on start', async () => {
      const worker = new EmailWorker();

      await worker.start();

      expect(dbConnectMock).toHaveBeenNthCalledWith(1, 'hawk_events');
      expect(dbConnectMock).toHaveBeenNthCalledWith(2, 'hawk');

      await worker.finish();
    });

    it('should query project on handle', async () => {
      const worker = new EmailWorker();

      await worker.handle({
        projectId: '5e3eef0679fa3700a0198a49',
        ruleId: '5e3eef0679fa3700a0198a49',
        events: [ {
          key: 'groupHash',
          count: 1,
        } ],
      });

      expect(projectQueryMock).toBeCalledWith({ _id: new ObjectID('5e3eef0679fa3700a0198a49') });
    });

    it('should query events on handle', async () => {
      const worker = new EmailWorker();

      await worker.handle({
        projectId: '5e3eef0679fa3700a0198a49',
        ruleId: '5e3eef0679fa3700a0198a49',
        events: [ {
          key: 'groupHash',
          count: 1,
        } ],
      });

      expect(eventsQueryMock).toBeCalledWith({ groupHash: 'groupHash' });
    });

    it('should query daily events count on handle', async () => {
      const worker = new EmailWorker();

      await worker.handle({
        projectId: '5e3eef0679fa3700a0198a49',
        ruleId: '5e3eef0679fa3700a0198a49',
        events: [ {
          key: 'groupHash',
          count: 1,
        } ],
      });

      expect(dailyEventsQueryMock).toBeCalledWith({ groupHash: 'groupHash' });
    });
  });
});
