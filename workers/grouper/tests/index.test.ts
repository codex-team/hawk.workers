import '../../../env-test';
import GrouperWorker from '../src';
import { GroupWorkerTask } from '../types/group-worker-task';
import { createClient, RedisClientType } from 'redis';
import { Collection, MongoClient } from 'mongodb';
import { EventAddons, EventDataAccepted } from '@hawk.so/types';
import { HawkEvent } from '@hawk.so/nodejs/dist/types';
import { projectIdMock } from './mocks/projectId';
import { generateTask } from './mocks/generateTask';
import { generateRandomId } from './mocks/randomId';

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
    public flushAll(): void {}

    // eslint-disable-next-line @typescript-eslint/no-empty-function, jsdoc/require-jsdoc
    public set(): void {}
  };
});


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
    });

    test('Should increment usersAffected count if users are different', async () => {
      await worker.handle(generateTask({ user: { id: generateRandomId() } }));
      await worker.handle(generateTask({ user: { id: generateRandomId() } }));
      await worker.handle(generateTask({ user: { id: generateRandomId() } }));
      await worker.handle(generateTask({ user: { id: generateRandomId() } }));

      expect((await eventsCollection.findOne({})).usersAffected).toBe(4);
    });

    test('Should not increment usersAffected count if already there is error from that user', async () => {
      await worker.handle(generateTask({ user: { id: 'kek' } }));
      await worker.handle(generateTask({ user: { id: 'foo' } }));
      await worker.handle(generateTask({ user: { id: 'kek' } }));
      await worker.handle(generateTask({ user: { id: 'foo' } }));

      expect((await eventsCollection.findOne({})).usersAffected).toBe(2);
    });

    test('Should increment usersAffected count if there is no user in original event', async () => {
      await worker.handle(generateTask());
      await worker.handle(generateTask({ user: { id: 'foo' } }));
      await worker.handle(generateTask({ user: { id: 'kek' } }));
      await worker.handle(generateTask({ user: { id: 'foo' } }));

      expect((await eventsCollection.findOne({})).usersAffected).toBe(3);
    });

    test('Should not increment usersAffected count if there is no user in processed event', async () => {
      await worker.handle(generateTask({ user: { id: 'kek' } }));
      await worker.handle(generateTask({ user: { id: 'foo' } }));
      await worker.handle(generateTask({ user: undefined }));
      await worker.handle(generateTask({ user: { id: 'foo' } }));

      expect((await eventsCollection.findOne({})).usersAffected).toBe(2);
    });

    test('Should stringify payload`s addons and context fields', async () => {
      await worker.handle(generateTask());

      const savedEvent = await eventsCollection.findOne({});

      expect(typeof savedEvent.payload.addons).toBe('string');
      expect(typeof savedEvent.payload.context).toBe('string');
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
          context: { test: '8fred' },
        },
      });

      const savedRepetition = await repetitionsCollection.findOne({});

      expect(typeof savedRepetition.payload.addons).toBe('string');
      expect(typeof savedRepetition.payload.context).toBe('string');
    });

    test('Should correctly calculate diff after encoding original event when they are the same', async () => {
      await worker.handle(generateTask());
      await worker.handle(generateTask());

      const savedRepetition = await repetitionsCollection.findOne({});
      const savedPayload = savedRepetition.payload as EventDataAccepted<EventAddons>;

      expect(savedPayload.title).toBe(undefined);
      expect(savedPayload.type).toBe(undefined);
      expect(savedPayload.backtrace).toBe(undefined);
      expect(savedPayload.context).toBe(undefined);
      expect(savedPayload.addons).toBe(undefined);
      expect(savedPayload.release).toBe(undefined);
      expect(savedPayload.user).toBe(undefined);
      expect(savedPayload.catcherVersion).toBe(undefined);

      /**
       * Timestamp always unique, so it should be present in a stored payload diff
       */
      expect(savedPayload.timestamp).not.toBe(undefined);
      expect(typeof savedPayload.timestamp).toBe('number');
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

      const savedRepetition = await repetitionsCollection.findOne({});
      const savedPayload = savedRepetition.payload as EventDataAccepted<EventAddons>;

      expect(savedPayload.context).toBe('{"testField":9}');
      expect(savedPayload.addons).toBe('{"vue":{"props":{"test-test":true}}}');
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
  });

  afterAll(async () => {
    await redisClient.quit();
    await worker.finish();
    await connection.close();
  });
});
