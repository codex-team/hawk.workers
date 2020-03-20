/**
 * This migration updates date from format `dd-mm-YYYY` to midnight unixtime
 * so that each client with different timezone could convert it to local time
 */
module.exports = {
  async up(db) {
    const collections = await db.listCollections({}, {
      authorizedCollections: true,
      nameOnly: true
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
            date: 'groupingTime',
            timestamp: 'lastRepetitionTime'
          }
        }
      );

    }
  },
};
