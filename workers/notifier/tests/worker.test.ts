import { ObjectID } from 'mongodb';
import {WhatToReceive} from '../src/validator';
import * as messageMock from './mock.json';

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
};

let dbQueryMock = jest.fn(() => ({
  notifications: [rule],
}));

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

// tslint:disable-next-line:class-name
class mockDBController {
  public connect(...args) {
    return dbConnectMock(...args);
  }

  public getConnection() {
    return dbConnectionMock();
  }

  public close() {
    dbCloseMock();
  }
}

describe('NotifierWorker', () => {
  jest.mock('../../../lib/db/controller', () => ({
    DatabaseController: mockDBController,
  }));

  const NotifierWorker = require('../src').default;

  it('should have correct worker type', () => {
    const worker = new NotifierWorker();

    expect(worker.type).toEqual('notifier');
  });

  it('should start without errors', async () => {
    const worker = new NotifierWorker();

    await worker.start();
  });

  describe('db calls', () => {
    it('should connect to db on start', async () => {
      const worker = new NotifierWorker();

      await worker.start();

      expect(dbConnectMock).toBeCalledWith('hawk');
    });

    it('should get db connection on message handle', async () => {
      const worker = new NotifierWorker();

      const message = {...messageMock};
      worker.sendToSenderWorker = jest.fn();

      await worker.handle(message);

      expect(dbConnectionMock).toBeCalled();
    });

    it('should query correct collection on message handle', async () => {
      const worker = new NotifierWorker();
      const message = {...messageMock};

      worker.sendToSenderWorker = jest.fn();

      await worker.handle(message);

      expect(dbCollectionMock).toBeCalledWith('projects');
    });

    it('should query correct project on message handle', async () => {
      const worker = new NotifierWorker();
      const message = {...messageMock};

      worker.sendToSenderWorker = jest.fn();

      await worker.handle(message);

      expect(dbQueryMock).toBeCalledWith({_id: new ObjectID(message.projectId)});
    });

    it('should close db connection on finish', async () => {
      const worker = new NotifierWorker();

      worker.sendToSenderWorker = jest.fn();

      await worker.finish();

      expect(dbCloseMock).toBeCalled();
    });
  });

  describe('handling', () => {

    it('should correctly handle first message', async () => {
      const worker = new NotifierWorker();

      worker.sendToSenderWorker = jest.fn();

      worker.buffer.push = jest.fn();
      worker.buffer.setTimer = jest.fn();

      const message = {...messageMock};
      const channels = ['telegram', 'slack'];
      const channelKeyPart = [message.projectId, rule._id];
      const events = [{key: message.event.groupHash, count: 1}];

      await worker.handle(message);

      expect(worker.buffer.setTimer).toBeCalledTimes(2);
      expect(worker.buffer.push).not.toBeCalled();

      channels.forEach((channel, i) => {
        expect(worker.buffer.setTimer).toHaveBeenNthCalledWith(
          i + 1,
          [...channelKeyPart, channel],
          rule.channels[channel].minPeriod * 1000,
          worker.sendEvents,
        );
        expect(worker.sendToSenderWorker).toHaveBeenNthCalledWith(
          i + 1,
          [...channelKeyPart, channels[i]],
          events,
        );
      });
    });

    it('should correctly handle messages after first one', async () => {
      const worker = new NotifierWorker();

      worker.sendToSenderWorker = jest.fn();

      jest.useFakeTimers();

      const realGetTimer = worker.buffer.getTimer;
      const realSetTimer = worker.buffer.setTimer;

      worker.buffer.getTimer = jest.fn((...args) => realGetTimer.apply(worker.buffer, args));
      worker.buffer.setTimer = jest.fn((...args) => realSetTimer.apply(worker.buffer, args));
      worker.buffer.push = jest.fn();

      const message = {...messageMock};
      const channels = ['telegram', 'slack'];
      const channelKeyPart = [message.projectId, rule._id];

      await worker.handle(message);
      await worker.handle(message);

      expect(worker.buffer.getTimer).toBeCalledTimes(4);
      expect(worker.buffer.push).toBeCalledTimes(2);
      expect(worker.sendToSenderWorker).toBeCalledTimes(2);

      channels.forEach((channel, i) => {
        expect(worker.buffer.push).toHaveBeenNthCalledWith(
          i + 1,
          [...channelKeyPart, channel, messageMock.event.groupHash],
        );
      });

      jest.useRealTimers();
    });

    it('should send events after timeout', async () => {
      const worker = new NotifierWorker();

      worker.sendToSenderWorker = jest.fn();

      const realSendEvents = worker.sendEvents;

      worker.sendEvents = jest.fn((...args) => realSendEvents.apply(worker, args));

      const realFlush = worker.buffer.flush;

      worker.buffer.flush = jest.fn((...args) => realFlush.apply(worker.buffer, args));

      const message = {...messageMock};
      const channels = ['telegram', 'slack'];
      const channelKeyPart = [message.projectId, rule._id];

      await worker.handle(message);
      await worker.handle(message);

      await new Promise((resolve) => setTimeout(() => {
        expect(worker.sendEvents).toBeCalledTimes(2);
        expect(worker.buffer.flush).toBeCalledTimes(2);

        channels.forEach((channel, i) => {
          expect(worker.buffer.flush).toHaveBeenNthCalledWith(
            i + 1,
            [...channelKeyPart, channel],
          );
          expect(worker.sendEvents).toHaveBeenNthCalledWith(
            i + 1,
            [...channelKeyPart, channel],
          );
        });

        resolve();
      }, 1000));
    });

    it('should do nothing if project doesn\'t exist', async () => {
      const worker = new NotifierWorker();

      worker.addEventsToChannels = jest.fn();

      const message = {...messageMock};

      const oldMock = dbQueryMock;

      dbQueryMock = jest.fn(() => null);

      await worker.handle(message);

      expect(worker.addEventsToChannels).not.toBeCalled();

      dbQueryMock = oldMock;
    });
  });

  it('should send task to sender workers', async () => {
    const worker = new NotifierWorker();

    worker.addTask = jest.fn();

    const message = {...messageMock};
    const channels = ['telegram', 'slack'];

    await worker.handle(message);

    setTimeout(() => {
      channels.forEach((channel, i) => {
        expect(worker.addTask).toHaveBeenNthCalledWith(
          i + 1,
          `sender/${channel}`,
          {
            projectId: message.projectId,
            ruleId: rule._id,
            events: [{key: message.event.groupHash, count: 1}],
          },
        );
      });
    }, 100);
  });
});
