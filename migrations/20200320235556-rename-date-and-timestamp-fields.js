/**
 * This migration renames date and timestamp fields to groupingTimestamp and lastRepetitionTime
 */
module.exports = {
  async up(db) {
    const collections = await db.listCollections({}, {
      authorizedCollections: true,
      nameOnly: true,
    }).toArray();

    const targetCollections = [];

    collections.forEach((collection) => {
      if (/dailyEvents/.test(collection.name)) {
        targetCollections.push(collection.name);
      }
    });

    for (const collectionName of targetCollections) {
      await db.collection(collectionName).updateMany(
        {},
        {
          $rename: {
            date: 'groupingTimestamp',
            timestamp: 'lastRepetitionTime',
          },
        }
      );
    }
  },
};
