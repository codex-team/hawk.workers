import '../../../env-test';
import GrouperWorker from '../src';
import { GroupWorkerTask } from '../types/group-worker-task';
import { createClient, RedisClientType } from 'redis';
import { Collection, MongoClient, ObjectID } from 'mongodb';
import { EventAddons, EventDataAccepted } from '@hawk.so/types';
import { MS_IN_SEC } from '../../../lib/utils/consts';

jest.mock('amqplib');

/**
 * Mock cache controller
 */
jest.mock('../../../lib/cache/controller', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return class CacheControllerMock {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, jsdoc/require-jsdoc
    public async get(key, resolver): Promise<any> {
      return resolver();
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function, jsdoc/require-jsdoc
    public flushAll(): void { }

    // eslint-disable-next-line @typescript-eslint/no-empty-function, jsdoc/require-jsdoc
    public set(): void { }
    
    // eslint-disable-next-line @typescript-eslint/no-empty-function, jsdoc/require-jsdoc
    public del(): void { }
  };
});

/**
 * Returns random string
 */
function generateRandomId(): string {
  return Math.random().toString(36)
    .substring(2, 15) +
    Math.random().toString(36)
      .substring(2, 15);
}

/**
 * Seconds in a day
 */
const secondsInDay = 24 * 60 * 60;

/**
 * Mocked Project id used for tests
 */
const projectIdMock = '5d206f7f9aaf7c0071d64596';

/**
 * Generates task for testing
 *
 * @param event - allows to override some event properties in generated task
 */
function generateTask(event: Partial<EventDataAccepted<EventAddons>> = undefined): GroupWorkerTask {
  return {
    projectId: projectIdMock,
    catcherType: 'grouper',
    event: Object.assign({
      title: 'Hawk client catcher test',
      timestamp: (new Date()).getTime(),
      backtrace: [],
      user: {
        id: generateRandomId(),
      },
      context: {
        testField: 8,
        'ima$ge.jpg': 'img',
      },
      addons: {
        vue: {
          props: {
            'test-test': false,
            'ima$ge.jpg': 'img',
          },
        },
      },
    }, event),
  };
}

describe('GrouperWorker', () => {
  let connection: MongoClient;
  let eventsCollection: Collection;
  let dailyEventsCollection: Collection;
  let repetitionsCollection: Collection;
  let redisClient: RedisClientType;
  let worker: GrouperWorker;

  beforeAll(async () => {
    worker = new GrouperWorker();

    await worker.start();
    connection = await MongoClient.connect(process.env.MONGO_EVENTS_DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    eventsCollection = connection.db().collection('events:' + projectIdMock);
    dailyEventsCollection = connection.db().collection('dailyEvents:' + projectIdMock);
    repetitionsCollection = connection.db().collection('repetitions:' + projectIdMock);

    /**
     * Create unique index for groupHash
     */
    await eventsCollection.createIndex({ groupHash: 1 }, { unique: true });

    redisClient = createClient({ url: process.env.REDIS_URL });
    await redisClient.connect();

    jest.resetAllMocks();
  });

  /**
   * Clears worker cache and mongodb before each test
   */
  beforeEach(async () => {
    worker.clearCache();
    await eventsCollection.deleteMany({});
    await dailyEventsCollection.deleteMany({});
    await repetitionsCollection.deleteMany({});
  });

  afterEach(async () => {
    await redisClient.flushAll();
  });

  describe('Saving events', () => {
    test('Should save event to database', async () => {
      const testGroupingTask = generateTask();

      await worker.handle(testGroupingTask);

      expect(await eventsCollection.find().count()).toBe(1);
    });

    test('Should increment total events count on each processing', async () => {
      await worker.handle(generateTask());
      await worker.handle(generateTask());
      await worker.handle(generateTask());
      await worker.handle(generateTask());

      expect((await eventsCollection.findOne({})).totalCount).toBe(4);
    });

    test('Should not increment total usersAffected count if it is event from first user', async () => {
      await worker.handle(generateTask({ user: { id: '123' } }));
      await worker.handle(generateTask({ user: { id: '123' } }));
      await worker.handle(generateTask({ user: { id: '123' } }));
      await worker.handle(generateTask({ user: { id: '123' } }));

      expect((await eventsCollection.findOne({})).usersAffected).toBe(1);
      expect((await dailyEventsCollection.findOne({})).affectedUsers).toBe(1);
    });

    test('Should increment usersAffected count if users are different', async () => {
      await worker.handle(generateTask());
      await worker.handle(generateTask());
      await worker.handle(generateTask());
      await worker.handle(generateTask());

      expect((await eventsCollection.findOne({})).usersAffected).toBe(4);
      expect((await dailyEventsCollection.findOne({})).affectedUsers).toBe(4);
    });

    test('Should not increment usersAffected count if already there is error from that user', async () => {
      await worker.handle(generateTask({ user: { id: 'kek' } }));
      await worker.handle(generateTask({ user: { id: 'foo' } }));
      await worker.handle(generateTask({ user: { id: 'kek' } }));
      await worker.handle(generateTask({ user: { id: 'foo' } }));

      expect((await eventsCollection.findOne({})).usersAffected).toBe(2);
      expect((await dailyEventsCollection.findOne({})).affectedUsers).toBe(2);
    });

    test('Should increment usersAffected count if there is no user in original event', async () => {
      await worker.handle(generateTask());
      await worker.handle(generateTask({ user: { id: 'foo' } }));
      await worker.handle(generateTask({ user: { id: 'kek' } }));
      await worker.handle(generateTask({ user: { id: 'foo' } }));

      expect((await eventsCollection.findOne({})).usersAffected).toBe(3);
      expect((await dailyEventsCollection.findOne({})).affectedUsers).toBe(3);
    });

    test('Should not increment usersAffected count if there is no user in processed event', async () => {
      await worker.handle(generateTask({ user: { id: 'kek' } }));
      await worker.handle(generateTask({ user: { id: 'foo' } }));
      await worker.handle(generateTask({ user: undefined }));
      await worker.handle(generateTask({ user: { id: 'foo' } }));

      expect((await eventsCollection.findOne({})).usersAffected).toBe(2);
      expect((await dailyEventsCollection.findOne({})).affectedUsers).toBe(2);
    });

    test('Should increment daily affected users if affected users are the same as the previous day', async () => {
      const today = (new Date()).getTime() / MS_IN_SEC;
      const yesterday = today - secondsInDay;

      await worker.handle(generateTask({
        timestamp: yesterday,
        user: { id: 'customer1' },
      }));
      await worker.handle(generateTask({
        timestamp: yesterday,
        user: { id: 'customer2' },
      }));

      await worker.handle(generateTask({
        timestamp: today,
        user: { id: 'customer1' },
      }));
      await worker.handle(generateTask({
        timestamp: today,
        user: { id: 'customer2' },
      }));

      const dailyEvents = await dailyEventsCollection.find({}).toArray();

      expect(dailyEvents.length).toBe(2);
      expect(dailyEvents[0].affectedUsers).toBe(2);
      expect(dailyEvents[1].affectedUsers).toBe(2);
    });

    test('Should increment daily affected users if user is in original event, but incoming event has different day', async () => {
      const yesterday = (new Date()).getTime() / MS_IN_SEC - secondsInDay;
      const today = (new Date()).getTime() / MS_IN_SEC;

      await worker.handle(generateTask({
        timestamp: yesterday,
        user: { id: 'customer1' },
      }));
      await worker.handle(generateTask({
        timestamp: today,
        user: { id: 'customer1' },
      }));
      await worker.handle(generateTask({
        timestamp: today,
        user: { id: 'customer2' },
      }));

      /**
       * Get daily events ordered by timestamp desc
       */
      const dailyEvents = await dailyEventsCollection.find({
      }).sort({ timestamp: -1 })
        .toArray();

      expect(dailyEvents.length).toBe(2);
      /**
       * First event is from yesterday, so it should have 1 affected user
       */
      expect(dailyEvents[0].affectedUsers).toBe(1);
      /**
       * Second event is from today, so it should have 2 affected users
       */
      expect(dailyEvents[1].affectedUsers).toBe(2);
    });

    test('Should not increment affected users when there are several simultaneous events from the same user', async () => {
      await Promise.all([
        worker.handle(generateTask({ user: { id: 'customer211' } })),
        worker.handle(generateTask({ user: { id: 'customer211' } })),
        worker.handle(generateTask({ user: { id: 'customer211' } })),
      ]);

      expect((await eventsCollection.findOne({})).usersAffected).toBe(1);
      expect((await dailyEventsCollection.findOne({})).affectedUsers).toBe(1);
    });

    test('Should not increment daily affected users if user is empty', async () => {
      await worker.handle(generateTask({ user: undefined }));
      await worker.handle(generateTask({ user: undefined }));

      expect((await dailyEventsCollection.findOne({})).affectedUsers).toBe(0);
    });

    test('Should not increment daily affected users if user is not provided', async () => {
      await worker.handle(generateTask({ user: undefined }));
      await worker.handle(generateTask({ user: undefined }));

      expect((await eventsCollection.findOne({})).usersAffected).toBe(0);
    });

    test('Should stringify payload`s addons and context fields', async () => {
      await worker.handle(generateTask());

      expect(typeof (await eventsCollection.findOne({})).payload.addons).toBe('string');
      expect(typeof (await eventsCollection.findOne({})).payload.context).toBe('string');
    });

    test('Should save event even if its context is type of string', async () => {
      const task = generateTask();

      task.event.context = 'string context';
      await worker.handle(task);

      expect((await eventsCollection.findOne({})).payload.context).toBe(null);
    });
  });

  describe('Saving daily events', () => {
    test('Should save daily events record', async () => {
      const testGroupingTask = generateTask();

      await worker.handle(testGroupingTask);

      expect(await dailyEventsCollection.find().count()).toBe(1);
    });

    test('Should update events count per day', async () => {
      await worker.handle(generateTask());
      await worker.handle(generateTask());
      await worker.handle(generateTask());
      await worker.handle(generateTask());

      expect((await dailyEventsCollection.findOne({})).count).toBe(4);
    });

    test('Should update last repetition id', async () => {
      await worker.handle(generateTask());
      await worker.handle(generateTask());

      const repetition = await repetitionsCollection.findOne({});

      expect((await dailyEventsCollection.findOne({})).lastRepetitionId).toEqual(repetition._id);
    });
  });

  describe('Saving repetitions', () => {
    test('Should save event repetitions on processing', async () => {
      await worker.handle(generateTask());
      await worker.handle(generateTask());
      await worker.handle(generateTask());

      const originalEvent = await eventsCollection.findOne({});

      expect((await repetitionsCollection.find({
        groupHash: originalEvent.groupHash,
      }).toArray()).length).toBe(2);
    });

    test('Should stringify payload`s addons and context fields', async () => {
      const generatedTask = generateTask();

      await worker.handle(generateTask());
      await worker.handle({
        ...generatedTask,
        event: {
          ...generatedTask.event,
          addons: { test: '8fred' },
        },
      });

      const savedRepetition = await repetitionsCollection.findOne({});

      expect(typeof savedRepetition.payload.addons).toBe('string');
      expect(typeof savedRepetition.payload.context).toBe('string');
    });

    test('Should correctly calculate diff after encoding original event when they are the same', async () => {
      await worker.handle(generateTask());
      await worker.handle(generateTask());

      expect((await repetitionsCollection.findOne({})).payload.context).toBe('{}');

      /**
       * Should to be true when bug in utils.deepDiff will be fixed
       */
      // expect((await repetitionsCollection.findOne({})).payload.addons).toBe('{}');
    });

    test('Should correctly calculate diff after encoding original event when they are different', async () => {
      await worker.handle(generateTask());

      const generatedTask = generateTask();

      await worker.handle({
        ...generatedTask,
        event: {
          ...generatedTask.event,
          context: {
            testField: 9,
          },
          addons: {
            vue: {
              props: { 'test-test': true },
            },
          },
        },
      });

      expect((await repetitionsCollection.findOne({})).payload.context).toBe('{"testField":9}');
      expect((await repetitionsCollection.findOne({})).payload.addons).toBe('{"vue":{"props":{"test-test":true}}}');
    });
  });

  describe('Grouping', () => {
    test('should group events with partially different titles', async () => {
      await worker.handle(generateTask({ title: 'Some error (but not filly identical) example' }));
      await worker.handle(generateTask({ title: 'Some error (yes, it is not the identical) example' }));
      await worker.handle(generateTask({ title: 'Some error (and it is not identical) example' }));

      const originalEvent = await eventsCollection.findOne({});

      expect((await repetitionsCollection.find({
        groupHash: originalEvent.groupHash,
      }).toArray()).length).toBe(2);
    });

    test('should group events with titles mathing one pattern', async () => {
      jest.spyOn(GrouperWorker.prototype as any, 'getProjectPatterns').mockResolvedValue(['New error .*']);

      const findMatchingPatternSpy = jest.spyOn(GrouperWorker.prototype as any, 'findMatchingPattern');

      await worker.handle(generateTask({title: 'New error 0000000000000000'}));
      await worker.handle(generateTask({title: 'New error 1111111111111111'}));
      await worker.handle(generateTask({title: 'New error 2222222222222222'}));

      const originalEvent = await eventsCollection.findOne({});
      
      /**
       * Make sure, that we searched for matching patterns for event
       * That means, that events are not groped by Levenstein
       */
      expect(findMatchingPatternSpy).toHaveBeenCalledTimes(3)

      expect((await repetitionsCollection.find({
        groupHash: originalEvent.groupHash,
      }).toArray()).length).toBe(2);
    })
  });

  afterAll(async () => {
    await redisClient.quit();
    await worker.finish();
    await connection.close();
  });
});
