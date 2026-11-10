import '../../../env-test';
import { MongoClient, ObjectID } from 'mongodb';
import type { Db } from 'mongodb';
import { ensureEventIndexes, EVENT_COLLECTIONS_INDEXES } from '../src/utils/eventIndexes';

describe('ensureEventIndexes', () => {
  let connection: MongoClient;
  let db: Db;

  beforeAll(async () => {
    connection = await MongoClient.connect(process.env.MONGO_EVENTS_DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    db = connection.db();
  });

  afterAll(async () => {
    await connection.close();
  });

  it('creates missing collections with all indexes and reports nothing on the next run', async () => {
    const projectId = new ObjectID().toString();

    expect(await ensureEventIndexes(db, projectId)).toEqual({
      created: ['events', 'repetitions', 'dailyEvents'],
      missing: [],
    });

    for (const [prefix, specs] of Object.entries(EVENT_COLLECTIONS_INDEXES)) {
      const names = (await db.collection(`${prefix}:${projectId}`).indexes()).map(index => index.name);

      expect(names.sort()).toEqual([...specs.map(spec => spec.name), '_id_'].sort());
    }

    const events = db.collection(`events:${projectId}`);

    await events.insertOne({ groupHash: 'hash' });
    await expect(events.insertOne({ groupHash: 'hash' })).rejects.toMatchObject({ code: 11000 });

    expect(await ensureEventIndexes(db, projectId)).toEqual({
      created: [],
      missing: [],
    });
  });

  it('reports indexes missing in an existing collection without building them', async () => {
    const projectId = new ObjectID().toString();
    const events = db.collection(`events:${projectId}`);

    await events.createIndex({ groupHash: 1 });

    const report = await ensureEventIndexes(db, projectId);

    expect(report).toEqual({
      created: ['repetitions', 'dailyEvents'],
      missing: ['events.payloadRelease', 'events.groupHashUnique', 'events.timestamp'],
    });
    expect(await events.indexes()).toHaveLength(2);
  });
});
