import '../../../env-test';
import { Collection, Db, MongoClient, ObjectID } from 'mongodb';
import type { GroupedEventDBScheme, ReleaseDBScheme, RepetitionDBScheme } from '@hawk.so/types';
import { validateReleases } from '../src/validate-releases';

const PROJECT_ID = 'release-validator-project';
const HOUR_IN_SECONDS = 60 * 60;
const NOW_SECONDS = Math.floor(new Date('2026-09-17T12:00:00.000Z').getTime() / 1000);
const NOW = new Date(NOW_SECONDS * 1000);

/**
 * Create a release ObjectId with a predictable creation time.
 *
 * @param hoursBeforeNow - release age in hours
 */
function releaseId(hoursBeforeNow: number): ObjectID {
  return ObjectID.createFromTime(NOW_SECONDS - hoursBeforeNow * HOUR_IN_SECONDS);
}

/**
 * Create a release record for the test project.
 *
 * @param release - release name
 * @param hoursBeforeNow - release age in hours
 * @param fixChecked - whether the release has already been checked
 */
function createRelease(release: string, hoursBeforeNow: number, fixChecked = false): ReleaseDBScheme {
  return {
    _id: releaseId(hoursBeforeNow),
    projectId: PROJECT_ID,
    release,
    commits: [],
    fixChecked,
  };
}

/**
 * Create an original event.
 *
 * @param groupHash - event group hash
 * @param release - release in which the event first occurred
 * @param resolvedInRelease - existing resolved release
 */
function createEvent(groupHash: string, release: string, resolvedInRelease?: string): GroupedEventDBScheme {
  const event: GroupedEventDBScheme = {
    _id: new ObjectID(),
    groupHash,
    payload: {
      title: groupHash,
      release,
    },
    totalCount: 1,
    catcherType: 'errors/default',
    usersAffected: 0,
    visitedBy: [],
    timestamp: NOW_SECONDS,
  };

  if (resolvedInRelease !== undefined) {
    event.resolvedInRelease = resolvedInRelease;
  }

  return event;
}

/**
 * Create an event repetition.
 *
 * @param groupHash - event group hash
 * @param release - release in which the event occurred
 */
function createRepetition(groupHash: string, release: string): RepetitionDBScheme {
  return {
    groupHash,
    release,
    timestamp: NOW_SECONDS,
  };
}

describe('validateReleases', () => {
  let connection: MongoClient;
  let db: Db;
  let releases: Collection<ReleaseDBScheme>;
  let events: Collection<GroupedEventDBScheme>;
  let repetitions: Collection<RepetitionDBScheme>;

  beforeAll(async () => {
    connection = await MongoClient.connect(process.env.MONGO_EVENTS_DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    db = connection.db();
    releases = db.collection<ReleaseDBScheme>('releases');
    events = db.collection<GroupedEventDBScheme>(`events:${PROJECT_ID}`);
    repetitions = db.collection<RepetitionDBScheme>(`repetitions:${PROJECT_ID}`);
  });

  beforeEach(async () => {
    await releases.deleteMany({ projectId: PROJECT_ID });
    await events.deleteMany({});
    await repetitions.deleteMany({});
  });

  afterAll(async () => {
    await releases.deleteMany({ projectId: PROJECT_ID });
    await events.drop().catch(() => undefined);
    await repetitions.drop().catch(() => undefined);
    await connection.close();
  });

  test('should not resolve an event that first appeared in the checked release', async () => {
    await releases.insertMany([
      createRelease('a', 72, true),
      createRelease('b', 48),
    ]);
    await events.insertOne(createEvent('error-1', 'b'));

    await validateReleases(db, NOW);

    expect((await events.findOne({ groupHash: 'error-1' })).resolvedInRelease).toBeUndefined();
    expect((await releases.findOne({ release: 'b' })).fixChecked).toBe(true);
  });

  test('should not resolve an event that occurred in the checked release', async () => {
    await releases.insertMany([
      createRelease('a', 72, true),
      createRelease('b', 48),
    ]);
    await events.insertOne(createEvent('error-2', 'a'));
    await repetitions.insertOne(createRepetition('error-2', 'b'));

    await validateReleases(db, NOW);

    expect((await events.findOne({ groupHash: 'error-2' })).resolvedInRelease).toBeUndefined();
  });

  test('should not resolve an event that reappeared in a newer release within 24 hours', async () => {
    await releases.insertMany([
      createRelease('a', 72, true),
      createRelease('b', 48),
      createRelease('c', 2),
    ]);
    await events.insertOne(createEvent('error-3', 'a'));
    await repetitions.insertOne(createRepetition('error-3', 'c'));

    await validateReleases(db, NOW);

    expect((await events.findOne({ groupHash: 'error-3' })).resolvedInRelease).toBeUndefined();
    expect((await releases.findOne({ release: 'b' })).fixChecked).toBe(true);
    expect((await releases.findOne({ release: 'c' })).fixChecked).toBe(false);
  });

  test('should resolve an event in the checked release when it never appears again', async () => {
    await releases.insertMany([
      createRelease('a', 72, true),
      createRelease('b', 48),
      createRelease('c', 2),
    ]);
    await events.insertOne(createEvent('error-4', 'a'));

    await validateReleases(db, NOW);

    expect((await events.findOne({ groupHash: 'error-4' })).resolvedInRelease).toBe('b');
  });

  test('should resolve an event in the first checked release after its last occurrence', async () => {
    await releases.insertMany([
      createRelease('a', 120, true),
      createRelease('b', 96),
      createRelease('c', 72),
      createRelease('d', 48),
    ]);
    await events.insertOne(createEvent('error-5', 'a'));
    await repetitions.insertOne(createRepetition('error-5', 'c'));

    await validateReleases(db, NOW);

    expect((await events.findOne({ groupHash: 'error-5' })).resolvedInRelease).toBe('d');
  });

  test('should not check a release until its 24-hour observation period has elapsed', async () => {
    await releases.insertMany([
      createRelease('a', 48, true),
      createRelease('b', 23),
    ]);
    await events.insertOne(createEvent('error-6', 'a'));

    await validateReleases(db, NOW);

    expect((await events.findOne({ groupHash: 'error-6' })).resolvedInRelease).toBeUndefined();
    expect((await releases.findOne({ release: 'b' })).fixChecked).toBe(false);
  });

  test('should skip an event when its original release is unknown', async () => {
    await releases.insertOne(createRelease('b', 48));
    await events.insertOne(createEvent('error-7', 'unknown'));

    await validateReleases(db, NOW);

    expect((await events.findOne({ groupHash: 'error-7' })).resolvedInRelease).toBeUndefined();
    expect((await releases.findOne({ release: 'b' })).fixChecked).toBe(true);
  });

  test('should not overwrite an existing resolved release on repeated validation', async () => {
    await releases.insertMany([
      createRelease('a', 72, true),
      createRelease('b', 48),
    ]);
    await events.insertOne(createEvent('error-8', 'a', 'previous-release'));

    await validateReleases(db, NOW);
    await validateReleases(db, NOW);

    expect((await events.findOne({ groupHash: 'error-8' })).resolvedInRelease).toBe('previous-release');
  });

  test('should skip a malformed release and continue with the next valid release', async () => {
    await releases.insertMany([
      createRelease('a', 96, true),
      {
        _id: releaseId(72),
        projectId: PROJECT_ID,
        release: 123 as unknown as string,
        commits: [],
      },
      createRelease('d', 48),
    ]);
    await events.insertOne(createEvent('error-9', 'a'));

    await expect(validateReleases(db, NOW)).resolves.toBeUndefined();

    expect((await events.findOne({ groupHash: 'error-9' })).resolvedInRelease).toBe('d');
    expect((await releases.findOne({ release: 123 as unknown as string })).fixChecked).toBeUndefined();
    expect((await releases.findOne({ release: 'd' })).fixChecked).toBe(true);
  });

  test('should skip a malformed event without stopping valid events', async () => {
    await releases.insertMany([
      createRelease('a', 72, true),
      createRelease('b', 48),
    ]);
    await events.insertMany([
      {
        _id: new ObjectID(),
        groupHash: 'broken-event',
        payload: {
          title: 'broken-event',
        },
        totalCount: 1,
        catcherType: 'errors/default',
        usersAffected: 0,
        visitedBy: [],
        timestamp: NOW_SECONDS,
      },
      createEvent('valid-event', 'a'),
    ]);

    await expect(validateReleases(db, NOW)).resolves.toBeUndefined();

    expect((await events.findOne({ groupHash: 'broken-event' })).resolvedInRelease).toBeUndefined();
    expect((await events.findOne({ groupHash: 'valid-event' })).resolvedInRelease).toBe('b');
  });

  test('should ignore a repetition without a release', async () => {
    await releases.insertMany([
      createRelease('a', 72, true),
      createRelease('b', 48),
    ]);
    await events.insertOne(createEvent('error-10', 'a'));
    await repetitions.insertOne({
      groupHash: 'error-10',
      timestamp: NOW_SECONDS,
    });

    await expect(validateReleases(db, NOW)).resolves.toBeUndefined();

    expect((await events.findOne({ groupHash: 'error-10' })).resolvedInRelease).toBe('b');
  });

  test('should ignore a repetition from an unknown release', async () => {
    await releases.insertMany([
      createRelease('a', 72, true),
      createRelease('b', 48),
    ]);
    await events.insertOne(createEvent('error-11', 'a'));
    await repetitions.insertOne(createRepetition('error-11', 'unknown'));

    await expect(validateReleases(db, NOW)).resolves.toBeUndefined();

    expect((await events.findOne({ groupHash: 'error-11' })).resolvedInRelease).toBe('b');
  });

  test('should resolve an event again after its regression stops occurring', async () => {
    await releases.insertMany([
      createRelease('a', 120, true),
      createRelease('b', 96, true),
      createRelease('c', 72, true),
      createRelease('d', 48),
    ]);
    const event = createEvent('error-cycle', 'a', 'b');

    event.regressionInRelease = 'c';
    await events.insertOne(event);
    await repetitions.insertOne(createRepetition('error-cycle', 'c'));

    await validateReleases(db, NOW);

    const updatedEvent = await events.findOne({ groupHash: 'error-cycle' });

    expect(updatedEvent.resolvedInRelease).toBe('d');
    expect(updatedEvent.regressionInRelease).toBe('c');
  });

  test('should not resolve an event again before a release newer than its regression', async () => {
    await releases.insertMany([
      createRelease('a', 96, true),
      createRelease('b', 72, true),
      createRelease('c', 48),
    ]);
    const event = createEvent('error-active-regression', 'a', 'b');

    event.regressionInRelease = 'c';
    await events.insertOne(event);
    await repetitions.insertOne(createRepetition('error-active-regression', 'c'));

    await validateReleases(db, NOW);

    expect((await events.findOne({ groupHash: 'error-active-regression' })).resolvedInRelease).toBe('b');
  });

  test('should not select a release older than 30 days as a candidate', async () => {
    await releases.insertMany([
      createRelease('a', 960, true),
      createRelease('b', 744),
    ]);
    await events.insertOne(createEvent('error-12', 'a'));

    await validateReleases(db, NOW);

    expect((await events.findOne({ groupHash: 'error-12' })).resolvedInRelease).toBeUndefined();
    expect((await releases.findOne({ release: 'b' })).fixChecked).toBe(false);
  });

  test('should use a release older than 30 days as event history', async () => {
    await releases.insertMany([
      createRelease('a', 960, true),
      createRelease('b', 48),
    ]);
    await events.insertOne(createEvent('error-13', 'a'));

    await validateReleases(db, NOW);

    expect((await events.findOne({ groupHash: 'error-13' })).resolvedInRelease).toBe('b');
  });
});
