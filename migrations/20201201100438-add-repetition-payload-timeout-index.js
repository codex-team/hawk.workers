/**
 * @file This migration creates indexes for repetition collection on payload.timeout field
 */

/**
 * Index name for payload.timeout field
 */
const payloadTimeoutIndexName = 'payloadTimeout';

module.exports = {
  async up(db) {
    const collections = await db.listCollections({}, {
      authorizedCollections: true,
      nameOnly: true,
    }).toArray();

    const targetCollections = [];

    collections.forEach((collection) => {
      if (/repetitions/.test(collection.name)) {
        targetCollections.push(collection.name);
      }
    });

    console.log('Start adding indexes to payload.timeout');
    console.log(`${targetCollections.length} collections will be updated.`);

    let currentCollectionNumber = 1;

    for (const collectionName of targetCollections) {
      const hasIndexAlready = await db.collection(collectionName).indexExists(payloadTimeoutIndexName);

      console.log(`${currentCollectionNumber} of ${targetCollections.length} in process.`);

      if (!hasIndexAlready) {
        await db.collection(collectionName).createIndex({
          'payload.timeout': 1,
        }, {
          name: payloadTimeoutIndexName,
          sparse: true,
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
      if (/repetitions/.test(collection.name)) {
        targetCollections.push(collection.name);
      }
    });

    console.log('Start dropping indexes to payload.timeout');
    console.log(`${targetCollections.length} collections will be updated.`);

    let currentCollectionNumber = 1;

    for (const collectionName of targetCollections) {
      console.log(`${currentCollectionNumber} of ${targetCollections.length} in process.`);

      await db.collection(collectionName).dropIndex(payloadTimeoutIndexName);
      console.log('Index dropped', collectionName);
      currentCollectionNumber++;
    }
  },
};
