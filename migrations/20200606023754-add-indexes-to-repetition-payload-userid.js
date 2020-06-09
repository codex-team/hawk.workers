/**
 * @file This migration creates indexes for repetition collection on payload.user.id field
 */

/**
 * Index name for payload.user.id field
 */
const userIdIndexName = 'userId';

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

    console.log('Start adding indexes to payload.user.id');
    console.log(`${targetCollections.length} collections will be updated.`);

    let currentCollectionNumber = 1;

    for (const collectionName of targetCollections) {
      const hasIndexAlready = await db.collection(collectionName).indexExists(userIdIndexName);

      console.log(`${currentCollectionNumber} of ${targetCollections.length} in process.`);

      if (!hasIndexAlready) {
        await db.collection(collectionName).createIndex({
          'payload.user.id': 1,
        }, {
          name: userIdIndexName,
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

    console.log('Start dropping indexes to payload.user.id');
    console.log(`${targetCollections.length} collections will be updated.`);

    let currentCollectionNumber = 1;

    for (const collectionName of targetCollections) {
      console.log(`${currentCollectionNumber} of ${targetCollections.length} in process.`);

      await db.collection(collectionName).dropIndex(userIdIndexName);
      console.log('Index dropped', collectionName);
      currentCollectionNumber++;
    }
  },
};
