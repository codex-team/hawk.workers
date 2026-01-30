import '../../../env-test';
import GrouperWorker from '../src';
import type { GroupWorkerTask, RepetitionDelta } from '../types/group-worker-task';
import type { RedisClientType } from 'redis';
import { createClient } from 'redis';
import type { Collection } from 'mongodb';
import { MongoClient } from 'mongodb';
import type { ErrorsCatcherType, EventAddons, EventData } from '@hawk.so/types';
import { MS_IN_SEC } from '../../../lib/utils/consts';
import TimeMs from '../../../lib/utils/time';
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
const planIdMock = new mongodb.ObjectId();
const workspaceIdMock = new mongodb.ObjectId();

const planMock = {
  _id: planIdMock,
  rateLimitSettings: {
    N: 0,
    T: 0,
  },
};

const workspaceMock = {
  _id: workspaceIdMock,
  tariffPlanId: planIdMock,
  rateLimitSettings: {
    N: 0,
    T: 0,
  },
};

const projectMock = {
  _id: new mongodb.ObjectId(projectIdMock),
  id: projectIdMock,
  name: 'Test Project',
  token: 'test-token',
  workspaceId: workspaceIdMock,
  uidAdded: {
    id: 'test-user-id',
  },
  unreadCount: 0,
  description: 'Test project for grouper worker tests',
  rateLimitSettings: {
    N: 0,
    T: 0,
  },
  eventGroupingPatterns: [ {
    _id: mongodb.ObjectId(),
    pattern: 'New error .*',
  } ],
};

/**
 * Generates task for testing
 *
 * @param event - allows to override some event properties in generated task
 * @param timestamp - timestamp of the event, defaults to current time
 */
function generateTask(event: Partial<EventData<EventAddons>> = undefined, timestamp: number = new Date().getTime()): GroupWorkerTask<ErrorsCatcherType> {
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
  let workspacesCollection: Collection;
  let plansCollection: Collection;
  let redisClient: RedisClientType;
  let worker: GrouperWorker;
  const setPlanRateLimit = async (eventsLimit: number, eventsPeriod: number): Promise<void> => {
    await plansCollection.updateOne(
      { _id: planIdMock },
      { $set: { rateLimitSettings: { N: eventsLimit, T: eventsPeriod } } },
      { upsert: true }
    );
  };
  const setWorkspaceRateLimit = async (eventsLimit: number, eventsPeriod: number): Promise<void> => {
    await workspacesCollection.updateOne(
      { _id: workspaceIdMock },
      { $set: { rateLimitSettings: { N: eventsLimit, T: eventsPeriod } } },
      { upsert: true }
    );
  };
  const setProjectRateLimit = async (eventsLimit: number, eventsPeriod: number): Promise<void> => {
    await projectsCollection.updateOne(
      { _id: new mongodb.ObjectId(projectIdMock) },
      { $set: { rateLimitSettings: { N: eventsLimit, T: eventsPeriod } } },
    );
  };

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
    workspacesCollection = accountsConnection.db().collection('workspaces');
    plansCollection = accountsConnection.db().collection('plans');

    /**
     * Create unique index for groupHash
     */
    await eventsCollection.createIndex({ groupHash: 1 }, { unique: true });

    await plansCollection.insertOne(planMock);
    await workspacesCollection.insertOne(workspaceMock);

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
    delete (worker as any)['memoizeCache:getProjectRateLimitSettings'];
    await eventsCollection.deleteMany({});
    await dailyEventsCollection.deleteMany({});
    await repetitionsCollection.deleteMany({});
    await setPlanRateLimit(0, 0);
    await setWorkspaceRateLimit(0, 0);
    await setProjectRateLimit(0, 0);
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

      task.payload.context = 'string context';
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

    test('Should correctly calculate diff after encoding original event when they are the same', async () => {
      await worker.handle(generateTask({ user: { id: '123' } }));
      await worker.handle(generateTask({ user: { id: '123' } }));

      const savedRepetition = await repetitionsCollection.findOne({});

      const savedDelta = savedRepetition.delta;
      const parsedDelta = savedDelta as RepetitionDelta;

      expect(parsedDelta).toBe(null);
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
    describe('Pattern matching', () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      test('should group events with titles matching one pattern', async () => {
        jest.spyOn(GrouperWorker.prototype as any, 'getProjectPatterns').mockResolvedValue([
          {
            _id: new mongodb.ObjectId(),
            pattern: 'New error .*',
          },
        ]);
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
          {
            _id: mongodb.ObjectId(),
            pattern: 'Database error: .*',
          },
          {
            _id: mongodb.ObjectId(),
            pattern: 'Network error: .*',
          },
          {
            _id: mongodb.ObjectId(),
            pattern: 'New error: .*',
          },
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
          {
            _id: mongodb.ObjectId(),
            pattern: 'Error \\d{3}: [A-Za-z\\s]+ in file .*\\.js$',
          },
          {
            _id: mongodb.ObjectId(),
            pattern: 'Warning \\d{3}: .*',
          },
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
          {
            _id: mongodb.ObjectId(),
            pattern: 'TypeError: .*',
          },
          {
            _id: mongodb.ObjectId(),
            pattern: 'ReferenceError: .*',
          },
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
          {
            _id: new mongodb.ObjectID(),
            pattern: 'Error \\[\\d+\\]: .*',
          },
          {
            _id: new mongodb.ObjectID(),
            pattern: 'Warning \\(code=\\d+\\): .*',
          },
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

    describe('dynamic pattern addition', () => {
      test('should group events when pattern added after we receive the first event', async () => {
        /**
         * Remove all existing patterns from the project
         */
        jest.spyOn(GrouperWorker.prototype as any, 'getProjectPatterns').mockResolvedValue([]);

        /**
         * Two nearly identical titles that could be grouped by `New error .*` pattern
         */
        const firstTitle = 'Dynamic pattern error 1111111111111111';
        const secondTitle = 'Dynamic pattern error 2222222222222222';

        await worker.handle(generateTask({ title: firstTitle }));
        await worker.handle(generateTask({ title: secondTitle }));

        const originalsBefore = await eventsCollection.find().toArray();

        expect(originalsBefore.length).toBe(2);

        const originalA = originalsBefore.find(e => e.payload.title === firstTitle)!;
        const originalB = originalsBefore.find(e => e.payload.title === secondTitle)!;

        expect(originalA).toBeTruthy();
        expect(originalB).toBeTruthy();

        /**
         * Two events should be stored separately since grouping patterns of the project were empty
         */
        expect(originalA.groupHash).not.toBe(originalB.groupHash);

        jest.spyOn(GrouperWorker.prototype as any, 'getProjectPatterns').mockResolvedValue([
          {
            _id: new mongodb.ObjectId(),
            pattern: 'Dynamic pattern error .*',
          },
        ]);

        /**
         * Second title should be grouped with first event that matches inserted grouping pattern
         * It should not be grouped with the existing event with same item because it violates grouping pattern logic
         */
        await worker.handle(generateTask({ title: secondTitle }));

        const allEvents = await eventsCollection.find().toArray();
        const allRepetitions = await repetitionsCollection.find().toArray();

        /**
         * Should still be only 2 original event documents in the DB
         */
        expect(allEvents.length).toBe(2);

        const refreshedOriginalA = await eventsCollection.findOne({ _id: originalA._id });
        const refreshedOriginalB = await eventsCollection.findOne({ _id: originalB._id });

        // totalCount: originalA should have 2 (1 original + 1 new repetition),
        // originalB should remain 1.
        expect(refreshedOriginalA?.totalCount).toBe(2);
        expect(refreshedOriginalB?.totalCount).toBe(1);

        // Repetitions should be 1 and must reference originalA's groupHash
        expect(allRepetitions.length).toBe(1);
        allRepetitions.forEach(rep => {
          expect(rep.groupHash).toBe(refreshedOriginalA!.groupHash);
        });

        /**
         * Original B should have zero repetitions despite same title with latest event passed
         */
        const repsForOriginalB = await repetitionsCollection.find({ groupHash: refreshedOriginalB!.groupHash }).count();

        expect(repsForOriginalB).toBe(0);
      });
    });
  });

  describe('Event marks handling', () => {
    describe('Ignored events', () => {
      it('should not add task for NotifierWorker when event is marked as ignored', async () => {
        const mockAddTask = jest
          .spyOn(worker as any, 'addTask')
          .mockImplementation(() => Promise.resolve());

        // Create an event first
        const firstTask = generateTask({ title: 'Test ignored event' });

        await worker.handle(firstTask);

        // Mark the event as ignored by updating it in database
        const eventHash = await (worker as any).getUniqueEventHash(firstTask);

        await eventsCollection.updateOne(
          { groupHash: eventHash },
          { $set: { marks: { ignored: true } } }
        );

        // Handle the same event again (repetition)
        const secondTask = generateTask({ title: 'Test ignored event' });

        await worker.handle(secondTask);

        // Verify that addTask was called only once (for the first occurrence)
        expect(mockAddTask).toHaveBeenCalledTimes(1);

        mockAddTask.mockRestore();
      });

      it('should add task for NotifierWorker when event is not marked as ignored', async () => {
        const mockAddTask = jest
          .spyOn(worker as any, 'addTask')
          .mockImplementation(() => Promise.resolve());

        // Create an event first
        const firstTask = generateTask({ title: 'Test non-ignored event' });

        await worker.handle(firstTask);

        // Handle the same event again (repetition) - without marking as ignored
        const secondTask = generateTask({ title: 'Test non-ignored event' });

        await worker.handle(secondTask);

        // Verify that addTask was called twice (for both occurrences)
        expect(mockAddTask).toHaveBeenCalledTimes(2);

        mockAddTask.mockRestore();
      });

      it('should add task for NotifierWorker for first occurrence even if marks field is undefined', async () => {
        const mockAddTask = jest
          .spyOn(worker as any, 'addTask')
          .mockImplementation(() => Promise.resolve());

        // Create a new event (first occurrence)
        const task = generateTask({ title: 'Test new event without marks' });

        await worker.handle(task);

        // Verify that addTask was called for the first occurrence
        expect(mockAddTask).toHaveBeenCalledTimes(1);
        expect(mockAddTask).toHaveBeenCalledWith('notifier', {
          projectId: task.projectId,
          event: {
            title: task.payload.title,
            groupHash: expect.any(String),
            isNew: true,
            repetitionId: null,
          },
        });

        mockAddTask.mockRestore();
      });
    });
  });

  describe('Rate limits counter increment', () => {
    const rateLimitsKey = 'rate_limits';

    test('increments counter when handling an event', async () => {
      await setProjectRateLimit(5, 60);

      let currentTime = 1_000_000;
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

      try {
        await worker.handle(generateTask());

        const storedValue = await redisClient.hGet(rateLimitsKey, projectIdMock);

        expect(storedValue).toBe(`${Math.floor(currentTime / 1000)}:1`);
      } finally {
        nowSpy.mockRestore();
      }
    });

    test('reuses window and increments while within limit', async () => {
      await setProjectRateLimit(5, 60);

      let currentTime = 2_000_000;
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

      try {
        await worker.handle(generateTask());
        await worker.handle(generateTask());

        const storedValue = await redisClient.hGet(rateLimitsKey, projectIdMock);

        expect(storedValue).not.toBeNull();

        const [, count] = (storedValue as string).split(':');

        expect(Number(count)).toBe(2);
      } finally {
        nowSpy.mockRestore();
      }
    });

    test('does not exceed configured limit within same window', async () => {
      const eventsLimit = 3;

      await setProjectRateLimit(eventsLimit, 60);

      let currentTime = 3_000_000;
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

      try {
        for (let i = 0; i < eventsLimit + 2; i++) {
          await worker.handle(generateTask());
        }

        const storedValue = await redisClient.hGet(rateLimitsKey, projectIdMock);

        expect(storedValue).not.toBeNull();

        const [, count] = (storedValue as string).split(':');

        expect(Number(count)).toBe(eventsLimit);
      } finally {
        nowSpy.mockRestore();
      }
    });

    test('resets window after period elapses', async () => {
      await setProjectRateLimit(5, 2);

      let currentTime = 4_000_000;
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

      try {
        await worker.handle(generateTask());

        currentTime += 3_000; // advance by 3 seconds

        await worker.handle(generateTask());

        const storedValue = await redisClient.hGet(rateLimitsKey, projectIdMock);

        expect(storedValue).not.toBeNull();

        const [timestamp, count] = (storedValue as string).split(':');

        expect(Number(timestamp)).toBe(Math.floor(currentTime / 1000));
        expect(Number(count)).toBe(1);
      } finally {
        nowSpy.mockRestore();
      }
    });

    test('uses workspace limits when project overrides are absent', async () => {
      await setPlanRateLimit(10, 60);
      await setWorkspaceRateLimit(3, 60);
      await setProjectRateLimit(0, 0);

      let currentTime = 5_000_000;
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

      try {
        for (let i = 0; i < 5; i++) {
          await worker.handle(generateTask());
        }

        const storedValue = await redisClient.hGet(rateLimitsKey, projectIdMock);

        expect(storedValue).not.toBeNull();

        const [, count] = (storedValue as string).split(':');

        expect(Number(count)).toBe(3);
      } finally {
        nowSpy.mockRestore();
      }
    });

    test('falls back to plan limits when workspace settings are empty', async () => {
      await setPlanRateLimit(4, 60);
      await setWorkspaceRateLimit(0, 0);
      await setProjectRateLimit(0, 0);

      let currentTime = 6_000_000;
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

      try {
        for (let i = 0; i < 6; i++) {
          await worker.handle(generateTask());
        }

        const storedValue = await redisClient.hGet(rateLimitsKey, projectIdMock);

        expect(storedValue).not.toBeNull();

        const [, count] = (storedValue as string).split(':');

        expect(Number(count)).toBe(4);
      } finally {
        nowSpy.mockRestore();
      }
    });

    test('prefers project limits over workspace and plan', async () => {
      await setPlanRateLimit(4, 60);
      await setWorkspaceRateLimit(6, 60);
      await setProjectRateLimit(8, 60);

      let currentTime = 7_000_000;
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

      try {
        for (let i = 0; i < 10; i++) {
          await worker.handle(generateTask());
        }

        const storedValue = await redisClient.hGet(rateLimitsKey, projectIdMock);

        expect(storedValue).not.toBeNull();

        const [, count] = (storedValue as string).split(':');

        expect(Number(count)).toBe(8);
      } finally {
        nowSpy.mockRestore();
      }
    });
  });

  describe('Events-stored metrics', () => {
    test('writes minutely, hourly, and daily samples after handling an event', async () => {
      const safeTsAddSpy = jest.spyOn((worker as any).redis, 'safeTsAdd');

      try {
        await worker.handle(generateTask());

        expect(safeTsAddSpy).toHaveBeenCalledTimes(3);

        const expectedLabels = {
          type: 'error',
          status: 'events-stored',
          project: projectIdMock,
        };

        expect(safeTsAddSpy).toHaveBeenNthCalledWith(
          1,
          `ts:project-events-stored:${projectIdMock}:minutely`,
          1,
          expectedLabels,
          TimeMs.DAY,
        );
        expect(safeTsAddSpy).toHaveBeenNthCalledWith(
          2,
          `ts:project-events-stored:${projectIdMock}:hourly`,
          1,
          expectedLabels,
          TimeMs.WEEK,
        );
        expect(safeTsAddSpy).toHaveBeenNthCalledWith(
          3,
          `ts:project-events-stored:${projectIdMock}:daily`,
          1,
          expectedLabels,
          90 * TimeMs.DAY,
        );
      } finally {
        safeTsAddSpy.mockRestore();
      }
    });

    test('logs when a time-series write fails but continues processing', async () => {
      const safeTsAddSpy = jest.spyOn((worker as any).redis, 'safeTsAdd');
      const loggerErrorSpy = jest.spyOn((worker as any).logger, 'error').mockImplementation(() => undefined);
      const failure = new Error('TS failure');

      safeTsAddSpy
        .mockImplementationOnce(() => Promise.resolve())
        .mockImplementationOnce(async () => { throw failure; })
        .mockImplementationOnce(() => Promise.resolve());

      try {
        await worker.handle(generateTask());

        expect(loggerErrorSpy).toHaveBeenCalledWith('Failed to add hourly TS for events-stored', failure);
        expect(await eventsCollection.find().count()).toBe(1);
      } finally {
        safeTsAddSpy.mockRestore();
        loggerErrorSpy.mockRestore();
      }
    });

    test('records metrics exactly once per handled event', async () => {
      const recordMetricsSpy = jest.spyOn(worker as any, 'recordProjectMetrics');

      try {
        await worker.handle(generateTask());

        expect(recordMetricsSpy).toHaveBeenCalledTimes(1);
        expect(recordMetricsSpy).toHaveBeenCalledWith(projectIdMock, 'events-stored');
      } finally {
        recordMetricsSpy.mockRestore();
      }
    });
  });

  afterAll(async () => {
    await redisClient.quit();
    await worker.finish();
    await projectsCollection.deleteMany({});
    await workspacesCollection.deleteMany({});
    await plansCollection.deleteMany({});
    await accountsConnection.close();
    await connection.close();
  });
});
