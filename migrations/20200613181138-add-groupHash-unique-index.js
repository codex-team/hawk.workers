/**
 * @file This migration creates indexes for repetition collection on payload.user.id field
 */

const { asyncForEach } = require('./utils');

/**
 * Index name for payload.user.id field
 */
const indexName = 'groupHashUnique';

module.exports = {
  async up(db) {
    const collections = await db.listCollections({}, {
      authorizedCollections: true,
      nameOnly: true,
    }).toArray();

    const targetCollections = [];

    collections.forEach((collection) => {
      if (/events/.test(collection.name)) {
        targetCollections.push(collection.name);
      }
    });

    console.log('Start adding indexes to groupHash field');
    console.log(`${targetCollections.length} collections will be updated.`);

    let currentCollectionNumber = 1;

    for (const collectionName of targetCollections) {
      const hasIndexAlready = await db.collection(collectionName).indexExists(indexName);

      console.log(`${currentCollectionNumber} of ${targetCollections.length} in process.`);

      if (!hasIndexAlready) {
        const collection = db.collection(collectionName);

        /**
         * Find duplicated events
         */
        const groupedEvents = await collection
          .aggregate([
            {
              $group: {
                _id: '$groupHash',
                events: {
                  $push: {
                    _id: '$_id',
                    totalCount: '$totalCount',
                  },
                },
                count: { $sum: 1 },
              },
            },
            {
              $match: {
                count: { $gt: 1 },
              },
            },
          ])
          .toArray();

        /**
         * Remove duplicated events
         */
        await asyncForEach(groupedEvents, async (groupedEvent) => {
          const originalEvent = groupedEvent.events.pop();

          const totalCount = groupedEvent.events.reduce((acc, val) => acc + val.totalCount - 1, 0);
          const idsToRemove = groupedEvent.events.map(event => event._id);

          await collection.updateOne({
            _id: originalEvent._id,
          }, {
            $inc: {
              totalCount: totalCount,
            },
          });

          await collection.deleteMany({
            _id: {
              $in: idsToRemove,
            },
          });
        });

        await collection.createIndex({
          groupHash: 1,
        },
        {
          unique: true,
          name: indexName,
        });
        console.log('Create index', collectionName);
      } else {
        console.log('Skip', collectionName);
      }

      currentCollectionNumber++;
    }
  },
  async down(db) {
    const collections = await db.listCollections({}, {
      authorizedCollections: true,
      nameOnly: true,
    }).toArray();

    const targetCollections = [];

    collections.forEach((collection) => {
      if (/events/.test(collection.name)) {
        targetCollections.push(collection.name);
      }
    });

    console.log('Start dropping indexes from groupHash field');
    console.log(`${targetCollections.length} collections will be updated.`);

    let currentCollectionNumber = 1;

    for (const collectionName of targetCollections) {
      console.log(`${currentCollectionNumber} of ${targetCollections.length} in process.`);

      await db.collection(collectionName).dropIndex(indexName);
      console.log('Index dropped', collectionName);
      currentCollectionNumber++;
    }
  },
};
