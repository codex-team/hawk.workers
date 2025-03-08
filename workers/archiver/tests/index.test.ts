import { Collection, Db, MongoClient, ObjectId } from 'mongodb';
import { mockedDailyEvents, oldDailyEvents } from './dailyEvents.mock';
import { mockedRepetitions } from './repetitions.mock';
import ArchiverWorker from '../src';
import { mockedEvents } from './events.mock';
import '../../../env-test';
import { mockedReleases } from './releases.mock';
import { ProjectDBScheme } from '@hawk.so/types';
jest.mock('axios');
jest.mock('amqplib');

/**
 * Set test date at 01.05.2020 12:00 so that tests pass always at the same time
 */
// eslint-disable-next-line no-extend-native
Date.prototype.getTime = (): number => 1588334400 * 1000;
process.env.MAX_DAYS_NUMBER = '30';

const mockedProject: ProjectDBScheme = {
  notifications: [],
  token: '5342',
  integrationId: 'eyJpbnRlZ3JhdGlvbklkIjoiMzg3NGNkOWMtZjJiYS00ZDVkLTk5ZmQtM2UzZjYzMDcxYmJhIiwic2VjcmV0IjoiMGZhM2JkM2EtYmMyZC00YWRiLThlMWMtNjg2OGY0MzM1YjRiIn0=',
  uidAdded: new ObjectId('5e4ff518628a6c714515f4db'),
  workspaceId: new ObjectId('5e4ff518628a6c714515f4de'),
  _id: new ObjectId('5e4ff518628a6c714515f4da'),
  name: 'Test project',
};

describe('Archiver worker', () => {
  let connection: MongoClient | undefined;
  let db: Db | undefined;
  let dailyEventsCollection: Collection | undefined;
  let repetitionsCollection: Collection | undefined;
  let eventsCollection: Collection | undefined;
  let projectCollection: Collection | undefined;

  beforeAll(async () => {
    connection = await MongoClient.connect(process.env.MONGO_ACCOUNTS_DATABASE_URI, {
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

  // test('Should remove old releases', async () => {
  //   await db.collection('releases').insertMany(mockedReleases);

  //   const mockedReleasesLength = mockedReleases.length;

  //   const releasesToStay = {
  //     _id: new ObjectId(),
  //     projectId: '5e4ff518628a6c714515f4da',
  //     release: 'releasetostay',
  //     files: [ {
  //       _id: new ObjectId('5eb119ec6570b9405cdc5b48'),
  //     } ],
  //   };

  //   /**
  //    * Insert one release with object id based on current time, it should not be removed
  //    */
  //   await db.collection('releases').insert(releasesToStay)

  //   const worker = new ArchiverWorker();

  //   await worker.start();
  //   const gridFsDeleteMock = jest.spyOn(worker['gridFsBucket'], 'delete');

  //   await worker['removeOldReleases'](mockedProject);

  //   const newReleasesCollection = await db.collection('releases')
  //     .find({})
  //     .toArray();

  //   expect(newReleasesCollection).toEqual([
  //     mockedReleases[mockedReleasesLength - 2],
  //     mockedReleases[mockedReleasesLength - 1],
  //     releasesToStay,
  //   ]);

  //   expect(gridFsDeleteMock).toHaveBeenCalledTimes(mockedReleases.length - 2);
  //   await worker.finish();
  // });

  test('Should leave two releases if all of the releases are more than month old', async () => {
    /**
     * Clear collection after previous test
     */
    await db.collection('releases').deleteMany({});
    await db.collection('releases').insertMany(mockedReleases);

    const mockedReleasesLength = mockedReleases.length;

    const worker = new ArchiverWorker();

    await worker.start();

    await worker['removeOldReleases'](mockedProject);

    const newReleasesCollection = await db.collection('releases')
      .find({})
      .toArray();

    expect(newReleasesCollection).toEqual([
      mockedReleases[mockedReleasesLength - 2],
      mockedReleases[mockedReleasesLength - 1],
    ])
    await worker.finish();
  })

  afterAll(async () => {
    await db.dropCollection('releases');
    await db.dropCollection('projects');
    await db.dropCollection(`dailyEvents:${mockedProject._id.toString()}`);
    await db.dropCollection(`repetitions:${mockedProject._id.toString()}`);
    await db.dropCollection(`events:${mockedProject._id.toString()}`);
    await connection.close();
  });
});
