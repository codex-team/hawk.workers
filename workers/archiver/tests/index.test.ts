import { MongoClient, ObjectId } from 'mongodb';
import { mockedDailyEvents, oldDailyEvents } from './dailyEvents.mock';
import { mockedRepetitions } from './repetitions.mock';
import ArchiverWorker from '../src';
import { mockedEvents } from './events.mock';

const MONGO_DSN = 'mongodb://127.0.0.1:27019';

process.env.MONGO_DSN = MONGO_DSN;
process.env.MAX_DAYS_NUMBER = '30';
process.env.ACCOUNTS_DB_NAME = process.env.EVENTS_DB_NAME = 'hawk';

const mockedProject = {
  _id: new ObjectId('5e4ff518628a6c714515f4da'),
};

describe('Archiver worker', () => {
  let connection;
  let db;
  let dailyEventsCollection;
  let repetitionsCollection;
  let eventsCollection;
  let projectCollection;

  beforeAll(async () => {
    connection = await MongoClient.connect(MONGO_DSN, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    db = await connection.db('hawk');
    projectCollection = db.collection('projects');
    dailyEventsCollection = db.collection(`dailyEvents:${mockedProject._id.toString()}`);
    repetitionsCollection = db.collection(`repetitions:${mockedProject._id.toString()}`);
    eventsCollection = db.collection(`events:${mockedProject._id.toString()}`);

    await projectCollection.insertOne(mockedProject);
    await dailyEventsCollection.insertMany(mockedDailyEvents);
    await repetitionsCollection.insertMany(mockedRepetitions);
    await eventsCollection.insertMany(mockedEvents);
  });

  test('Should correctly remove old events', async () => {
    /**
     * Worker initialization
     */
    const worker = new ArchiverWorker();

    await worker.start();
    await worker.handle();
    await worker.finish();

    /**
     * Check that there is no old daily events in database
     */
    const oldDailyEventsQueryResult = await dailyEventsCollection.find({
      groupHash: {
        $in: oldDailyEvents,
      },
    }).toArray();

    expect(oldDailyEventsQueryResult.length).toBe(0);

    /**
     * Check that no extra events are deleted
     */
    const dailyEventsQueryResult = await dailyEventsCollection.find({}).toArray();

    expect(dailyEventsQueryResult.length).toBe(10);

    /**
     * Check that there is no old events in database
     */
    const oldEventsQueryResult = await eventsCollection.find({
      groupHash: {
        $in: oldDailyEvents,
      },
    }).toArray();

    expect(oldEventsQueryResult.length).toBe(0);

    /**
     * Check that archived events count is right
     */
    const archiveEventsCount = oldDailyEvents.reduce((acc, current) => acc + current.count, 0);

    const changedProject = await projectCollection.findOne({ _id: mockedProject._id });

    let originalEventsDeletedCount = 0;

    mockedEvents.forEach(event => {
      if (oldDailyEvents.find(daily => daily.groupHash === event.groupHash)) {
        originalEventsDeletedCount++;
      }
    });

    expect(changedProject.archivedEventsCount).toBe(archiveEventsCount + originalEventsDeletedCount);
  });

  afterAll(async () => {
    await connection.close();
    await db.close();
  });
});
