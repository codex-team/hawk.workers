/**
 * This migration creates indexes for repetition collection on groupHash field
 */
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

    for (const collectionName of targetCollections) {
      const hasIndexAlready = await db.collection(collectionName).indexExists('groupHash_hashed');

      if (!hasIndexAlready) {
        await db.collection(collectionName).createIndex({
          groupHash: 'hashed',
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
      if (/repetitions/.test(collection.name)) {
        targetCollections.push(collection.name);
      }
    });

    for (const collectionName of targetCollections) {
      await db.collection(collectionName).dropIndex({
        groupHash: 'hashed',
      });
    }
  },
};
