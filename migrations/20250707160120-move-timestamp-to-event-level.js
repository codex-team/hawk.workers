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
              timestamp: { $toDouble: "$payload.timestamp" },
            },
          },
          {
            $unset: "payload.timestamp",
          },
        ]
      );
    }

    // Step 2: Process repetition collections
    for (const collectionName of repetitionCollections) {
      const projectId = collectionName.split(':')[1];
      const collection = db.collection(collectionName);

      // Step 2.1: First, handle documents where payload.timestamp exists
      await collection.updateMany(
        { 'payload.timestamp': { $exists: true } },
        [
          {
            $set: {
              timestamp: { $toDouble: "$payload.timestamp" }, // Convert payload.timestamp to number
            },
          },
          {
            $unset: "payload.timestamp", // Remove payload.timestamp
          },
        ]
      );
        
      const pipeline = [
        {
          $match: {
            $or : [
              { "payload.timestamp": { $exists: false } },
              { payload: { $exists: false } },
            ],
            timestamp: { $exists: false },
            groupHash: { $exists: true }
          }
        },
        {
          $lookup: {
            from: `events:${projectId}`, // dynamically referencing the events collection
            localField: "groupHash", // field from repetitions collection
            foreignField: "groupHash", // field in the events collection
            as: "eventData" // alias for the matched data
          }
        },
        {
          $unwind: {
            path: "$eventData", // we expect only one match per groupHash
            preserveNullAndEmptyArrays: true // allow documents with no matching event
          }
        },
        {
          $match: {
            "eventData.timestamp": { $exists: true } // only proceed if event.timestamp exists
          }
        },
        {
          $project: {
            _id: 1,
            eventTimestamp: { $toDouble: "$eventData.timestamp"}
          }
        }
      ];
      
      const matchedDocs = await collection.aggregate(pipeline).toArray();

      const bulkOps = matchedDocs.map(doc => ({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: { timestamp: doc.eventTimestamp } // Set the timestamp from the event
          }
        }
      }));
      
      if (bulkOps.length > 0) {
        await collection.bulkWrite(bulkOps);
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
            $unset: { 'timestamp': "" },
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
            $unset: { 'timestamp': "" },
          },
        ]
      );
    }
  },
};
