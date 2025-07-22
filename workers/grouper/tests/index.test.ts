import '../../../env-test';
import GrouperWorker from '../src';
import type { GroupWorkerTask, RepetitionDelta } from '../types/group-worker-task';
import type { RedisClientType } from 'redis';
import { createClient } from 'redis';
import type { Collection } from 'mongodb';
import { MongoClient } from 'mongodb';
import type { CatcherMessagePayload, CatcherMessageType, EventAddons, EventData } from '@hawk.so/types';
import { MS_IN_SEC } from '../../../lib/utils/consts';
import * as mongodb from 'mongodb';
import { patch } from '@n1ru4l/json-patch-plus';

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
 * Mock project data
 */
const projectMock = {
  _id: new mongodb.ObjectId(projectIdMock),
  id: projectIdMock,
  name: 'Test Project',
  token: 'test-token',
  uidAdded: {
    id: 'test-user-id',
  },
  unreadCount: 0,
  description: 'Test project for grouper worker tests',
  eventGroupingPatterns: [ 'New error .*' ],
};

/**
 * Generates task for testing
 *
 * @param event - allows to override some event properties in generated task
 */
function generateTask(event: Partial<EventData<EventAddons>> = undefined, timestamp: number = new Date().getTime()): GroupWorkerTask<CatcherMessageType> {
  return {
    projectId: projectIdMock,
    catcherType: 'errors/javascript',
    timestamp,
    payload: Object.assign({
      title: 'Hawk client catcher test',
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
  let accountsConnection: MongoClient;
  let eventsCollection: Collection;
  let dailyEventsCollection: Collection;
  let repetitionsCollection: Collection;
  let projectsCollection: Collection;
  let redisClient: RedisClientType;
  let worker: GrouperWorker;

  beforeAll(async () => {
    worker = new GrouperWorker();

    await worker.start();
    connection = await MongoClient.connect(process.env.MONGO_EVENTS_DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    accountsConnection = await MongoClient.connect(process.env.MONGO_ACCOUNTS_DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    eventsCollection = connection.db().collection('events:' + projectIdMock);
    dailyEventsCollection = connection.db().collection('dailyEvents:' + projectIdMock);
    repetitionsCollection = connection.db().collection('repetitions:' + projectIdMock);
    projectsCollection = accountsConnection.db().collection('projects');

    /**
     * Create unique index for groupHash
     */
    await eventsCollection.createIndex({ groupHash: 1 }, { unique: true });

    /**
     * Insert mock project into accounts database
     */
    await projectsCollection.insertOne(projectMock);

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
      await worker.handle(generateTask({ user: { id: generateRandomId() } }));
      await worker.handle(generateTask({ user: { id: generateRandomId() } }));
      await worker.handle(generateTask({ user: { id: generateRandomId() } }));
      await worker.handle(generateTask({ user: { id: generateRandomId() } }));

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
        user: { id: 'customer1' },
      }, yesterday));
      await worker.handle(generateTask({
        user: { id: 'customer2' },
      }, yesterday));

      await worker.handle(generateTask({
        user: { id: 'customer1' },
      }, today));
      await worker.handle(generateTask({
        user: { id: 'customer2' },
      }, today));

      const dailyEvents = await dailyEventsCollection.find({}).toArray();

      expect(dailyEvents.length).toBe(2);
      expect(dailyEvents[0].affectedUsers).toBe(2);
      expect(dailyEvents[1].affectedUsers).toBe(2);
    });

    test('Should increment daily affected users if user is in original event, but incoming event has different day', async () => {
      const yesterday = (new Date()).getTime() / MS_IN_SEC - secondsInDay;
      const today = (new Date()).getTime() / MS_IN_SEC;

      await worker.handle(generateTask({
        user: { id: 'customer1' },
      }, yesterday));
      await worker.handle(generateTask({
        user: { id: 'customer1' },
      }, today));
      await worker.handle(generateTask({
        user: { id: 'customer2' },
      }, today));

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

      const savedEvent = await eventsCollection.findOne({});

      expect(typeof savedEvent.payload.addons).toBe('string');
      expect(typeof savedEvent.payload.context).toBe('string');
    });

    test('Should save event even if its context is type of string', async () => {
      const task = generateTask();

      // @todo export ErrorsCatcherType from types and use it here
      (task.payload as CatcherMessagePayload<'errors/javascript' | 'errors/php' | 'errors/nodejs' | 'errors/go' | 'errors/python'>).context = 'string context';
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

    test('Should stringify delta', async () => {
      const generatedTask = generateTask();

      await worker.handle(generateTask());
      await worker.handle({
        ...generatedTask,
        payload: {
          ...generatedTask.payload,
          addons: { test: '8fred' },
          context: { test: '8fred' },
        },
      });

      const savedRepetition = await repetitionsCollection.findOne({});

      expect(typeof savedRepetition.delta).toBe('string');
    });

    test.only('Should correctly calculate diff after encoding original event when they are the same', async () => {
      await worker.handle(generateTask({ user: { id: '123' } }));
      await worker.handle(generateTask({ user: { id: '123' } }));

      const savedRepetition = await repetitionsCollection.findOne({});

      const savedDelta = savedRepetition.delta;
      const parsedDelta = savedDelta as RepetitionDelta;

      expect(parsedDelta).toBe(null)
    });

    test('Should correctly calculate diff after encoding original event when they are different', async () => {
      const originalGeneratedEvent = generateTask();

      await worker.handle(originalGeneratedEvent);

      const generatedTask = generateTask();

      await worker.handle({
        ...generatedTask,
        payload: {
          ...generatedTask.payload,
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

      const savedEvent = await eventsCollection.findOne({});
      const savedRepetition = await repetitionsCollection.findOne({});
      const savedDelta = savedRepetition.delta as string;
      const parsedDelta = JSON.parse(savedDelta) as RepetitionDelta;

      /**
       * Parse context and addons from string to object
       */
      savedEvent.payload.context = JSON.parse(savedEvent.payload.context);
      savedEvent.payload.addons = JSON.parse(savedEvent.payload.addons);

      expect(typeof parsedDelta.context).toBe('object');
      expect(typeof parsedDelta.addons).toBe('object');

      const patched = patch({
        left: savedEvent.payload,
        delta: parsedDelta,
      });

      expect(patched.context).toEqual({
        testField: 9,
      });
      expect(patched.addons).toEqual({
        vue: {
          props: { 'test-test': true },
        },
      });
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

    describe('Pattern matching', () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      test('should group events with titles matching one pattern', async () => {
        jest.spyOn(GrouperWorker.prototype as any, 'getProjectPatterns').mockResolvedValue([ 'New error .*' ]);
        const findMatchingPatternSpy = jest.spyOn(GrouperWorker.prototype as any, 'findMatchingPattern');

        await worker.handle(generateTask({ title: 'New error 0000000000000000' }));
        await worker.handle(generateTask({ title: 'New error 1111111111111111' }));
        await worker.handle(generateTask({ title: 'New error 2222222222222222' }));

        const originalEvent = await eventsCollection.findOne({});

        expect(findMatchingPatternSpy).toHaveBeenCalledTimes(3);
        expect((await repetitionsCollection.find({
          groupHash: originalEvent.groupHash,
        }).toArray()).length).toBe(2);
      });

      test('should handle multiple patterns and match the first one that applies', async () => {
        jest.spyOn(GrouperWorker.prototype as any, 'getProjectPatterns').mockResolvedValue([
          'Database error: .*',
          'Network error: .*',
          'New error: .*',
        ]);

        await worker.handle(generateTask({ title: 'Database error: connection failed' }));
        await worker.handle(generateTask({ title: 'Database error: timeout' }));
        await worker.handle(generateTask({ title: 'Network error: timeout' }));

        const databaseEvents = await eventsCollection.find({ 'payload.title': /Database error.*/ }).toArray();
        const networkEvents = await eventsCollection.find({ 'payload.title': /Network error.*/ }).toArray();

        expect(databaseEvents.length).toBe(1);
        expect(networkEvents.length).toBe(1);
        expect(await repetitionsCollection.find().count()).toBe(1);
      });

      test('should handle complex regex patterns', async () => {
        jest.spyOn(GrouperWorker.prototype as any, 'getProjectPatterns').mockResolvedValue([
          'Error \\d{3}: [A-Za-z\\s]+ in file .*\\.js$',
          'Warning \\d{3}: .*',
        ]);

        await worker.handle(generateTask({ title: 'Error 404: Not Found in file index.js' }));
        await worker.handle(generateTask({ title: 'Error 404: Missing Route in file router.js' }));
        await worker.handle(generateTask({ title: 'Warning 301: Deprecated feature' }));

        const error404Events = await eventsCollection.find({ 'payload.title': /Error 404.*/ }).toArray();
        const warningEvents = await eventsCollection.find({ 'payload.title': /Warning.*/ }).toArray();

        expect(error404Events.length).toBe(1);
        expect(warningEvents.length).toBe(1);
        expect(await repetitionsCollection.find().count()).toBe(1);
      });

      test('should maintain separate groups for different patterns', async () => {
        jest.spyOn(GrouperWorker.prototype as any, 'getProjectPatterns').mockResolvedValue([
          'TypeError: .*',
          'ReferenceError: .*',
        ]);

        await worker.handle(generateTask({ title: 'TypeError: null is not an object' }));
        await worker.handle(generateTask({ title: 'TypeError: undefined is not a function' }));
        await worker.handle(generateTask({ title: 'ReferenceError: x is not defined' }));
        await worker.handle(generateTask({ title: 'ReferenceError: y is not defined' }));

        const typeErrors = await eventsCollection.find({ 'payload.title': /TypeError.*/ }).toArray();
        const referenceErrors = await eventsCollection.find({ 'payload.title': /ReferenceError.*/ }).toArray();

        expect(typeErrors.length).toBe(1);
        expect(referenceErrors.length).toBe(1);
        expect(await repetitionsCollection.find().count()).toBe(2);

        // Verify that events are grouped separately
        expect(typeErrors[0].groupHash).not.toBe(referenceErrors[0].groupHash);
      });

      test('should handle patterns with special regex characters', async () => {
        jest.spyOn(GrouperWorker.prototype as any, 'getProjectPatterns').mockResolvedValue([
          'Error \\[\\d+\\]: .*',
          'Warning \\(code=\\d+\\): .*',
        ]);

        await worker.handle(generateTask({ title: 'Error [123]: Database connection failed' }));
        await worker.handle(generateTask({ title: 'Error [123]: Query timeout' }));
        await worker.handle(generateTask({ title: 'Warning (code=456): Cache miss' }));

        const errorEvents = await eventsCollection.find({ 'payload.title': /Error \[\d+\].*/ }).toArray();
        const warningEvents = await eventsCollection.find({ 'payload.title': /Warning \(code=\d+\).*/ }).toArray();

        expect(errorEvents.length).toBe(1);
        expect(warningEvents.length).toBe(1);
        expect(await repetitionsCollection.find().count()).toBe(1);
      });
    });
  });

  afterAll(async () => {
    await redisClient.quit();
    await worker.finish();
    await projectsCollection.deleteMany({});
    await accountsConnection.close();
    await connection.close();
  });
});
