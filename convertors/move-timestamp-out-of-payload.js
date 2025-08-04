require('dotenv').config();
const { MongoClient } = require('mongodb');

/**
 * @param db - mongo db instance
 * @param collectionName - name of the collection to be updated
 */
async function movePayloadTimestampToEventLevel(db, collectionName) {
  const collection = db.collection(collectionName);

  const docsToUpdate = collection.find(
    { timestamp: { $exists: false } },
    { projection: { _id: 1, 'payload.timestamp': 1 } }
  ).limit(10000);

  const batchedOps = [];

  let currentCount = 0;

  for await (const doc of docsToUpdate) {
    process.stdout.write(`\r${currentCount} documents added to batch`);

    if (!doc.payload.timestamp) {
      continue;
    }

    batchedOps.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: { timestamp: Number(doc.payload.timestamp)},
          $unset: {'payload.timestamp': ''},
        }
      }
    })

    currentCount++;
  }

  if (currentCount > 0) {
    await collection.bulkWrite(batchedOps);
  }

  return currentCount
}
/**
 * @param db - mongo db instance
 * @param repetitionCollectionName - repetitions collection to be updated
 * @param projectId - project id of current repetitions collection
 */
async function backfillTimestampsFromEvents(db, repetitionCollectionName, projectId) {
  const repetitions = db.collection(repetitionCollectionName);
  const events = db.collection(`events:${projectId}`);

  let bulkOps = [];
  let repetitionCount = 1;

  const repetitionsList = await repetitions.find(
    {
      timestamp: { $exists: false },
    },
    { projection: { _id: 1, groupHash: 1 } }
  ).limit(10000).toArray();

  const groupHashList = [];

  for (const repetition of repetitionsList) {
    process.stdout.write(`\r[${repetitionCount} repetition] update with timestamp now have [${bulkOps.length + 1}] ops in bulkOps`);
    groupHashList.push(repetition.groupHash);
    repetitionCount++;
  }

  const relatedEvents = await events.find(
    { groupHash: { $in: groupHashList } },
    { projection: { timestamp: 1, groupHash: 1 } }
  ).toArray();

  const relatedEventsMap = new Map()

  relatedEvents.forEach(e => {
    relatedEventsMap.set(e.groupHash, e);
  })

  for (const repetition of repetitionsList) {
    const relatedEvent = relatedEventsMap.get(repetition.groupHash);

    if (!relatedEvent) {
      bulkOps.push({
        deleteOne: {
          filter: { _id: repetition._id }
        }
      })
    } else if (relatedEvent?.timestamp !== null) {
      bulkOps.push({
        updateOne: {
          filter: { _id: repetition._id },
          update: { $set: { timestamp: Number(relatedEvent.timestamp) } },
        },
      });
    }
  }

  let processed = 0;

  if (bulkOps.length > 0) {
    const result = await repetitions.bulkWrite(bulkOps);
    const updated = result.modifiedCount;
    const deleted = result.deletedCount;
    processed = bulkOps.length;
    console.log(`  updates (${processed} processed, ${updated} updated, ${deleted} deleted)`);

    if (updated + deleted === 0) {
      repetitionCollectionsToCheck.filter(collection => collection !== repetition)
    }
  }

  return processed;
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

  let eventCollectionsToCheck = collections.filter(col => /^events:/.test(col.name)).map(col => col.name);
  let repetitionCollectionsToCheck = collections.filter(col => /^repetitions:/.test(col.name)).map(col => col.name);

  console.log(`Found ${eventCollectionsToCheck.length} event collections.`);
  console.log(`Found ${repetitionCollectionsToCheck.length} repetition collections.`);

  // Convert events
  let i = 1;
  let total = 1

  while (total != 0) {
    total = 0;
    i = 1;
    const collectionsToUpdateCount = eventCollectionsToCheck.length;
  
    for (const collectionName of eventCollectionsToCheck) {
      console.log(`[${i}/${collectionsToUpdateCount}] Processing ${collectionName}`);
      const updated = await movePayloadTimestampToEventLevel(db, collectionName);

      total += updated
      i++;
    }
  } 

  // Convert repetitions + backfill from events
  total = 1;

  while (total != 0) {
    total = 0;
    i = 1;
    const collectionsToUpdateCount = repetitionCollectionsToCheck.length;

    for (const collectionName of repetitionCollectionsToCheck) {
      console.log(`[${i}/${collectionsToUpdateCount}] Processing ${collectionName}`);
      const projectId = collectionName.split(':')[1];

      let updated = 0;

      updated += await movePayloadTimestampToEventLevel(db, collectionName);
      updated += await backfillTimestampsFromEvents(db, collectionName, projectId);

      if (updated === 0) {
        repetitionCollectionsToCheck = repetitionCollectionsToCheck.filter(collection => collection !== collectionName);
      }

      total += updated;
      i++;
    }

    console.log(`Conversion iteration complete. ${total} documents updated`);
  }

  await client.close();
}

run().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
