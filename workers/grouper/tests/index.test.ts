import '../../../env-test';
import GrouperWorker from '../src';
import { GroupWorkerTask } from '../types/group-worker-task';
import redis from 'redis';
import { Collection, MongoClient } from 'mongodb';
import { EventAddons, EventDataAccepted } from 'hawk.types';

jest.mock('amqplib');

/**
 * Mock cache controller
 */
jest.mock('../../../lib/cache/controller', () => {
  return class CacheControllerMock {
    /**
     * Will call resolver without caching
     */
    public async get(key, resolver): Promise<any> {
      return resolver();
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public flushAll(): void {}

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public set(): void {}
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
  const worker = new GrouperWorker();
  let connection: MongoClient;
  let eventsCollection: Collection;
  let dailyEventsCollection: Collection;
  let repetitionsCollection: Collection;
  let redisClient;

  beforeAll(async () => {
    await worker.start();
    connection = await MongoClient.connect(process.env.MONGO_EVENTS_DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    eventsCollection = connection.db().collection('events:' + projectIdMock);
    dailyEventsCollection = connection.db().collection('dailyEvents:' + projectIdMock);
    repetitionsCollection = connection.db().collection('repetitions:' + projectIdMock);
    redisClient = redis.createClient({ url: process.env.REDIS_URL });
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

  afterEach((done) => {
    redisClient.flushall(done);
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
      await worker.handle(generateTask());
      await worker.handle(generateTask());
      await worker.handle(generateTask());
      await worker.handle(generateTask());

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

      expect(typeof (await eventsCollection.findOne({})).payload.addons).toBe('string');
      expect(typeof (await eventsCollection.findOne({})).payload.context).toBe('string');
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
  });

  afterAll(async () => {
    await worker.finish();
    await connection.close();
  });
});
