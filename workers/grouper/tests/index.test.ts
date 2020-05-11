/* tslint:disable:no-string-literal */
import GrouperWorker from '../src/index';
import { GroupWorkerTask } from '../types/group-worker-task';
import '../../../env-test';
import { Collection, MongoClient } from 'mongodb';

/**
 * Test Grouping task
 */
const testGroupingTask = {
  projectId: '5d206f7f9aaf7c0071d64596',
  catcherType: 'grouper',
  event: {
    title: 'Hawk client catcher test',
    timestamp: (new Date()).getTime(),
    backtrace: [],
  },
} as GroupWorkerTask;

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
 * Generates task for testing
 *
 * @param userId - user id in event
 */
function generateTask(userId = generateRandomId()): GroupWorkerTask {
  return {
    projectId: '5d206f7f9aaf7c0071d64596',
    catcherType: 'grouper',
    event: {
      title: 'Hawk client catcher test',
      timestamp: (new Date()).getTime(),
      backtrace: [],
      user: {
        id: userId,
      },
    },
  };
}

describe('GrouperWorker', () => {
  const worker = new GrouperWorker();
  let connection: MongoClient;
  let eventsCollection: Collection;
  let dailyEventsCollection: Collection;
  let repetitionsCollection: Collection;

  beforeAll(async () => {
    await worker.start();
    connection = await MongoClient.connect(process.env.MONGO_EVENTS_DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    eventsCollection = connection.db().collection('events:' + testGroupingTask.projectId);
    dailyEventsCollection = connection.db().collection('dailyEvents:' + testGroupingTask.projectId);
    repetitionsCollection = connection.db().collection('repetitions:' + testGroupingTask.projectId);
  });

  beforeEach(async () => {
    await eventsCollection.deleteMany({});
    await dailyEventsCollection.deleteMany({});
    await repetitionsCollection.deleteMany({});
  });

  describe('Saving events', () => {
    test('Should save event to database', async () => {
      await worker.handle(testGroupingTask);

      expect(await eventsCollection.find().count()).toBe(1);
    });

    test('Should increment total events count on each processing', async () => {
      await worker.handle(testGroupingTask);
      await worker.handle(testGroupingTask);
      await worker.handle(testGroupingTask);
      await worker.handle(testGroupingTask);

      expect((await eventsCollection.findOne({})).totalCount).toBe(4);
    });

    test('Should not increment total usersAffected count if it is event from first user', async () => {
      await worker.handle(generateTask('123'));
      await worker.handle(generateTask('123'));
      await worker.handle(generateTask('123'));
      await worker.handle(generateTask('123'));

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
      await worker.handle(generateTask('kek'));
      await worker.handle(generateTask('foo'));
      await worker.handle(generateTask('kek'));
      await worker.handle(generateTask('foo'));

      expect((await eventsCollection.findOne({})).usersAffected).toBe(2);
    });
  });

  describe('Saving daily events', () => {
    test('Should save daily events record', async () => {
      await worker.handle(testGroupingTask);

      expect(await dailyEventsCollection.find().count()).toBe(1);
    });

    test('Should update events count per day', async () => {
      await worker.handle(testGroupingTask);
      await worker.handle(testGroupingTask);
      await worker.handle(testGroupingTask);
      await worker.handle(testGroupingTask);

      expect((await dailyEventsCollection.findOne({})).count).toBe(4);
    });

    test('Should update last repetition id', async () => {
      await worker.handle(testGroupingTask);
      await worker.handle(testGroupingTask);

      const repetition = await repetitionsCollection.findOne({});

      expect((await dailyEventsCollection.findOne({})).lastRepetitionId).toEqual(repetition._id);
    });
  });

  describe('Saving repetitions', () => {
    test('Should save event repetitions on processing', async () => {
      await worker.handle(testGroupingTask);
      await worker.handle(testGroupingTask);
      await worker.handle(testGroupingTask);

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
