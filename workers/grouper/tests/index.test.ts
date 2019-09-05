import GrouperWorker from '../src/index';
import * as mongodb from 'mongodb';
import { GroupWorkerTask } from '../types/group-worker-task';

/**
 * Test Grouping task
 */
const testGroupingTask = {
  projectId: '5d206f7f9aaf7c0071d64596',
  catcherType: 'grouper',
  event: {
    title: 'Hawk client catcher test',
    timestamp: (new Date()).getTime(),
    backtrace: []
  }
} as GroupWorkerTask;

describe('GrouperWorker', () => {
  const worker = new GrouperWorker();

  test('should return correct worker type', () => {
    expect(worker.type).toEqual('grouper');
  });

  test('should start correctly', async () => {
    await worker.start();
  });

  test('should correctly handle task', async () => {
    await worker.handle(testGroupingTask);
  });

  test('show save event and return id', async () => {
    const result = await worker['saveEvent']('5d206f7f9aaf7c0071d64596', {
      catcherType: 'grouper',
      payload: {
        title: 'testing',
        timestamp: (new Date()).getTime(),
      },
      groupHash: '',
      totalCount: 1,
    });

    const insertedId = mongodb.ObjectID.isValid(result);

    expect(insertedId).toBe(true);
  });

  test('throw error on saveEvent if projectId is not a MongoId', async () => {
    await expect(
      /**
       * To test private method, we have to access it as dynamic prop.
       */
      worker['saveEvent']('10', {
        totalCount: 1,
        groupHash: '',
        catcherType: '',
        payload: {
          title: 'Test event',
          timestamp: Date.now() / 1000
        }
      })
    ).rejects.toThrowError();
  });

  test('save repetition should return mongodb id', async () => {
    /**
     * To test private method, we have to access it as dynamic prop.
     */
    const result = await worker['saveRepetition']('5d206f7f9aaf7c0071d64596', {
      groupHash: '1234567890',
      payload: {}
    });

    const insertedId = mongodb.ObjectID.isValid(result);

    expect(insertedId).toBe(true);
  });

  test('throw error on saveRepetition if project id is not mongodb id', async () => {
    await expect(
      /**
       * To test private method, we have to access it as dynamic prop.
       */
      worker['saveRepetition']('10', {
        groupHash: '1234567890',
        payload: {}
      })
    ).rejects.toThrowError();
  });

  test('throw error on incrementEventCounter if project id not mongodb id', async () => {
    await expect(
      /**
       * To test private method, we have to access it as dynamic prop.
       */
      worker['incrementEventCounter']('10', {})
    ).rejects.toThrowError();
  });

  test('should increment event', async () => {
    /**
     * To test private method, we have to access it as dynamic prop.
     */
    const result = await worker['incrementEventCounter']('5d206f7f9aaf7c0071d64596', {});

    expect(result).not.toBe(null);
  });

  test('should finish correctly', async () => {
    await worker.finish();
  });
});
