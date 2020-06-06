/**
 * This migration creates indexes for repetition collection on payload.user.id field
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
      const hasIndexAlready = await db.collection(collectionName).indexExists('userId');

      if (!hasIndexAlready) {
        await db.collection(collectionName).createIndex({
          'payload.user.id': 1,
        }, { name: 'userId' });
        console.log('Create index', collectionName);
      } else {
        console.log('Skip', collectionName);
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
      await db.collection(collectionName).dropIndex('userId');
      console.log('Index dropped', collectionName);
    }
  },
};
