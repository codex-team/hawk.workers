require('dotenv').config();
const { MongoClient } = require('mongodb');

/**
 * @param db - mongo db instance
 * @param collectionName - name of the collection to be updated
 */
async function movePayloadTimestampToEventLevel(db, collectionName) {
  const collection = db.collection(collectionName);
  const cursor = collection.find({ 'payload.timestamp': { $exists: true } }).batchSize(500);

  let processed = 0;
  let updated = 0;
  let bulkOps = [];

  for await (const doc of cursor) {
    const timestamp = Number(doc.payload?.timestamp);

    if (isNaN(timestamp)) {
      continue;
    }

    bulkOps.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: { timestamp: timestamp },
          $unset: { 'payload.timestamp': '' },
        },
      },
    });

    if (bulkOps.length === 1000) {
      const result = await collection.bulkWrite(bulkOps);

      updated += result.modifiedCount;
      processed += bulkOps.length;
      console.log(`  Flushed 1000 updates (${processed} processed, ${updated} updated)`);
      bulkOps = [];
    }
  }

  if (bulkOps.length > 0) {
    const result = await collection.bulkWrite(bulkOps);

    updated += result.modifiedCount;
    processed += bulkOps.length;
    console.log(`  Flushed final ${bulkOps.length} updates (${processed} processed, ${updated} updated)`);
  }

  console.log(`  Done with ${collectionName}: ${updated} documents updated`);
}

/**
 * @param db - mongo db instance
 * @param repetitionCollectionName - repetitions collection to be updated
 * @param projectId - project id of current repetitions collection
 */
async function backfillTimestampsFromEvents(db, repetitionCollectionName, projectId) {
  const collection = db.collection(repetitionCollectionName);

  const pipeline = [
    {
      $match: {
        $or: [
          { 'payload.timestamp': { $exists: false } },
          { payload: { $exists: false } },
        ],
        timestamp: { $exists: false },
        groupHash: { $exists: true },
      },
    },
    {
      $lookup: {
        from: `events:${projectId}`,
        localField: 'groupHash',
        foreignField: 'groupHash',
        as: 'eventData',
      },
    },
    {
      $unwind: {
        path: '$eventData',
        preserveNullAndEmptyArrays: true,
      },
    },
    { $match: { 'eventData.timestamp': { $exists: true } } },
    {
      $project: {
        _id: 1,
        eventTimestamp: { $toDouble: '$eventData.timestamp' },
      },
    },
  ];

  const cursor = collection.aggregate(pipeline, { allowDiskUse: true }).batchSize(500);

  let bulkOps = [];
  let processed = 0;

  for await (const doc of cursor) {
    bulkOps.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { timestamp: doc.eventTimestamp } },
      },
    });

    if (bulkOps.length === 1000) {
      const res = await collection.bulkWrite(bulkOps);

      processed += res.modifiedCount;
      bulkOps = [];
    }
  }

  if (bulkOps.length > 0) {
    const res = await collection.bulkWrite(bulkOps);

    processed += res.modifiedCount;
  }

  console.log(`  Done backfilling ${repetitionCollectionName}: ${processed} updated`);
}

/**
 * Method that runs convertor script
 */
async function run() {
  const fullUri = process.env.MONGO_EVENTS_DATABASE_URI;

  // Parse the Mongo URL manually
  const mongoUrl = new URL(fullUri);
  const databaseName = 'hawk_events';

  // Extract query parameters
  const queryParams = Object.fromEntries(mongoUrl.searchParams.entries());

  // Compose connection options manually
  const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    authSource: queryParams.authSource || 'admin',
    replicaSet: queryParams.replicaSet || undefined,
    tls: queryParams.tls === 'true',
    tlsInsecure: queryParams.tlsInsecure === 'true',
    // connectTimeoutMS: 3600000,
    // socketTimeoutMS: 3600000,
  };

  // Remove query string from URI
  mongoUrl.search = '';
  const cleanUri = mongoUrl.toString();

  console.log('Connecting to:', cleanUri);
  console.log('With options:', options);

  const client = new MongoClient(cleanUri, options);

  await client.connect();
  const db = client.db(databaseName);

  console.log(`Connected to database: ${databaseName}`);

  const collections = await db.listCollections({}, {
    authorizedCollections: true,
    nameOnly: true,
  }).toArray();

  const eventCollections = collections.filter(col => /^events:/.test(col.name)).map(col => col.name);
  const repetitionCollections = collections.filter(col => /^repetitions:/.test(col.name)).map(col => col.name);

  console.log(`Found ${eventCollections.length} event collections.`);
  console.log(`Found ${repetitionCollections.length} repetition collections.`);

  // Convert events
  let i = 1;

  for (const collectionName of eventCollections) {
    console.log(`[${i}/${eventCollections.length}] Processing ${collectionName}`);
    await movePayloadTimestampToEventLevel(db, collectionName);
    i++;
  }

  // Convert repetitions + backfill from events
  i = 1;
  for (const collectionName of repetitionCollections) {
    console.log(`[${i}/${repetitionCollections.length}] Processing ${collectionName}`);
    const projectId = collectionName.split(':')[1];

    await movePayloadTimestampToEventLevel(db, collectionName);
    await backfillTimestampsFromEvents(db, collectionName, projectId);

    i++;
  }

  await client.close();
  console.log('✅ Conversion complete.');
}

run().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
