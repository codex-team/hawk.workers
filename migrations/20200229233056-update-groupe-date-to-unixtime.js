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
      const rows = await db.collection(collectionName).find({}).toArray();

      for (const row of rows) {
        const id = row._id;
        const timestamp = row.timestamp;

        const date = new Date(timestamp * 1000);

        date.setHours(0, 0, 0, 0);
        const midnight = date.getTime() / 1000;

        await db.collection(collectionName).updateOne({
          _id: id
        }, {
          $set: {
            date: midnight
          }
        });
      }
    }
  },
};
