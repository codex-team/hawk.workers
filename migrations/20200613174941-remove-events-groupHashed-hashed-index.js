/**
 * @file This migration drops indexes for groupHash field in events
 */

/**
 * Index name for groupHash
 */
const indexName = 'groupHash_hashed';

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

    console.log('Start dropping indexes from groupHash field');
    console.log(`${targetCollections.length} collections will be updated.`);

    let currentCollectionNumber = 1;

    for (const collectionName of targetCollections) {
      const hasIndexAlready = await db.collection(collectionName).indexExists(indexName);

      console.log(`${currentCollectionNumber} of ${targetCollections.length} in process.`);

      if (hasIndexAlready) {
        await db.collection(collectionName).dropIndex(indexName);
        console.log('Dropped index', collectionName);
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

      await db.collection(collectionName).createIndex({
        groupHash: 'hashed',
      }, {
        name: indexName,
      });
      console.log('Index created', collectionName);
      currentCollectionNumber++;
    }
  },
};
