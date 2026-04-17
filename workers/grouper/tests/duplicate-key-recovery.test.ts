import GrouperWorker from '../src';
import type { GroupWorkerTask } from '../types/group-worker-task';
import type { ErrorsCatcherType, EventAddons, EventData } from '@hawk.so/types';

jest.mock('amqplib');

/**
 * Ensure DatabaseController constructor sees some connection string
 * so it does not throw before we stub database dependencies on worker instance.
 */
process.env.MONGO_EVENTS_DATABASE_URI = process.env.MONGO_EVENTS_DATABASE_URI || 'mongodb://127.0.0.1:27017/hawk-test';
process.env.MONGO_ACCOUNTS_DATABASE_URI = process.env.MONGO_ACCOUNTS_DATABASE_URI || 'mongodb://127.0.0.1:27017/hawk-test';

/**
 * Generates minimal task for testing
 *
 * @param event - allows to override some event properties in generated task
 */
function generateTask(event: Partial<EventData<EventAddons>> = undefined): GroupWorkerTask<ErrorsCatcherType> {
  return {
    projectId: '5d206f7f9aaf7c0071d64596',
    catcherType: 'errors/javascript',
    timestamp: Math.floor(Date.now() / 1000),
    payload: Object.assign({
      title: 'Duplicate key recovery test',
      backtrace: [],
      user: {
        id: 'user-1',
      },
      context: {},
      addons: {},
    }, event),
  };
}

describe('GrouperWorker duplicate key error recovery (cache interaction)', () => {
  let worker: GrouperWorker;

  beforeEach(() => {
    worker = new GrouperWorker();

    /**
     * Prepare real in-memory cache controller
     */
    (worker as unknown as { prepareCache: () => void }).prepareCache();

    /**
     * Stub external dependencies that are not relevant for this unit test
     */
    (worker as any).eventsDb = {};
    (worker as any).accountsDb = {};
    (worker as any).redis = {
      checkOrSetlockEventForAffectedUsersIncrement: jest.fn().mockResolvedValue(false),
      checkOrSetlockDailyEventForAffectedUsersIncrement: jest.fn().mockResolvedValue(false),
      safeTsAdd: jest.fn().mockResolvedValue(undefined),
    };
  });

  test('Should invalidate stale event cache and process duplicate-key as repetition instead of recursing infinitely', async () => {
    const task = generateTask();
    const cache = (worker as any).cache;

    const uniqueEventHash = 'test-hash';

    /**
     * Always use the same hash and force grouping by hash (no patterns)
     */
    jest.spyOn(worker as any, 'getUniqueEventHash').mockResolvedValue(uniqueEventHash);
    jest.spyOn(worker as any, 'findSimilarEvent').mockResolvedValue(undefined);

    const eventCacheKey = await (worker as any).getEventCacheKey(task.projectId, uniqueEventHash);

    /**
     * Simulate stale cache entry created before another worker inserted the event
     * Cached value is null, but the "database" already contains the event
     */
    cache.set(eventCacheKey, null);

    const dbEvent = {
      groupHash: uniqueEventHash,
      payload: task.payload,
      timestamp: task.timestamp,
      totalCount: 1,
    };

    /**
     * Use real CacheController semantics for getEvent: first call returns cached null,
     * subsequent calls should see the real event once the cache key is deleted.
     */
    (worker as any).getEvent = jest.fn(async () => {
      return cache.get(eventCacheKey, async () => dbEvent);
    });

    /**
     * saveEvent always throws duplicate-key error to trigger the recursive path.
     * With the fix, this branch is executed only once; without the fix it will
     * recurse indefinitely because isFirstOccurrence stays true.
     */
    const duplicateError: NodeJS.ErrnoException = new Error('E11000 duplicate key error') as NodeJS.ErrnoException;

    duplicateError.code = '11000';

    const saveEventMock = jest.fn(async () => {
      throw duplicateError;
    });

    (worker as any).saveEvent = saveEventMock;

    const incrementMock = jest.fn().mockResolvedValue(1);
    const saveRepetitionMock = jest.fn().mockResolvedValue('rep-1');
    const saveDailyEventsMock = jest.fn().mockResolvedValue(undefined);
    const recordMetricsMock = jest.fn().mockResolvedValue(undefined);

    (worker as any).incrementEventCounterAndAffectedUsers = incrementMock;
    (worker as any).saveRepetition = saveRepetitionMock;
    (worker as any).saveDailyEvents = saveDailyEventsMock;
    (worker as any).recordProjectMetrics = recordMetricsMock;

    await worker.handle(task);

    /**
     * Without the cache invalidation fix, this call above would never resolve
     * because handle() would recurse indefinitely on duplicate-key error.
     * The assertions below verify that we only tried to insert once and then
     * proceeded as a repetition with a cached original event.
     */
    expect(saveEventMock).toHaveBeenCalledTimes(1);
    expect((worker as any).getEvent).toHaveBeenCalledTimes(2);
    expect(incrementMock).toHaveBeenCalledTimes(1);
    expect(saveRepetitionMock).toHaveBeenCalledTimes(1);
    expect(saveDailyEventsMock).toHaveBeenCalledTimes(1);
    expect(recordMetricsMock).toHaveBeenCalledTimes(1);
  }, 10000);
});

