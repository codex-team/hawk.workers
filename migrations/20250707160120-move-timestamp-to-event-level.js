/**
 * This migration moves `payload.timestamp` to top-level `timestamp`
 * for both `events:*` and `repetitions:*` collections.
 */

module.exports = {
  async up(db) {
    const collections = await db.listCollections({}, {
      authorizedCollections: true,
      nameOnly: true,
    }).toArray();

    // Separate collections by prefix
    const eventCollections = collections
      .filter(col => /^events:/.test(col.name))
      .map(col => col.name);

    const repetitionCollections = collections
      .filter(col => /^repetitions:/.test(col.name))
      .map(col => col.name);

    // Step 1: Process event collections
    for (const collectionName of eventCollections) {
      await db.collection(collectionName).updateMany(
        { 'payload.timestamp': { $exists: true } },
        [
          {
            $set: {
              timestamp: '$payload.timestamp',
            },
          },
          {
            $unset: 'payload.timestamp',
          },
        ]
      );
    }

    // Step 2: Process repetition collections
    for (const collectionName of repetitionCollections) {
      const collection = db.collection(collectionName);
      const cursor = collection.find({});

      while (await cursor.hasNext()) {
        const doc = await cursor.next();

        if (doc.payload?.timestamp) {
          // Move timestamp from payload to root
          await collection.updateOne(
            { _id: doc._id },
            {
              $set: { timestamp: doc.payload.timestamp },
              $unset: { 'payload.timestamp': '' },
            }
          );
        } else if (doc.groupHash) {
          // Attempt to find matching event
          let eventDoc = null;

          const projectId = collectionName.split(':')[1];
          const eventsCollectionName = `events:${projectId}`;

          eventDoc = await db.collection(eventsCollectionName).findOne({ groupHash: doc.groupHash });

          if (eventDoc?.timestamp) {
            await collection.updateOne(
              { _id: doc._id },
              {
                $set: { timestamp: eventDoc.timestamp },
              }
            );
          }
        }
      }
    }
  },

  async down(db) {
    const collections = await db.listCollections({}, {
      authorizedCollections: true,
      nameOnly: true,
    }).toArray();

    const eventCollections = collections
      .filter(col => /^events:/.test(col.name))
      .map(col => col.name);

    const repetitionCollections = collections
      .filter(col => /^repetitions:/.test(col.name))
      .map(col => col.name);

    // Revert event collections
    for (const collectionName of eventCollections) {
      await db.collection(collectionName).updateMany(
        { timestamp: { $exists: true } },
        [
          {
            $set: {
              'payload.timestamp': '$timestamp',
            },
          },
          {
            $unset: 'timestamp',
          },
        ]
      );
    }

    // Revert repetition collections
    for (const collectionName of repetitionCollections) {
      await db.collection(collectionName).updateMany(
        { timestamp: { $exists: true } },
        [
          {
            $set: {
              'payload.timestamp': '$timestamp',
            },
          },
          {
            $unset: 'timestamp',
          },
        ]
      );
    }
  },
};
