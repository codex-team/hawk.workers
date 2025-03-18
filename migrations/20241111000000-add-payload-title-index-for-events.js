/**
 * This migration creates indexes for all collections on payload.title field
 */

/**
 * Index name for payload.title field
 */
const payloadTitleIndexName = 'payloadTitle';

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

    for (const collectionName of targetCollections) {
      const hasIndexAlready = await db.collection(collectionName).indexExists(payloadTitleIndexName);

      if (!hasIndexAlready) {
        await db.collection(collectionName).createIndex({
          'payload.title': 1,
        }, {
          name: payloadTitleIndexName,
        });
      }
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

    for (const collectionName of targetCollections) {
      await db.collection(collectionName).dropIndex(payloadTitleIndexName);
    }
  },
};