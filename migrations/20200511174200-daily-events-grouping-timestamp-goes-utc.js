/**
 * This migration updates the groupingTimestamp fields in dailyEvents collections.
 *
 * The problem:
 *
 * The solution:
 *
 */
module.exports = {
  async up(db) {
    const collections = await db.listCollections({}, {
      authorizedCollections: true,
      nameOnly: true,
    }).toArray();

    const targetCollections = collections
      .filter(({ name }) => /dailyEvents/.test(name))
      .map(({ name }) => name);

    for (const collectionName of targetCollections) {
      const rows = await db.collection(collectionName)
        .find({})
        .toArray();

      for (const row of rows) {
        const oldTimestamp = row.groupingTimestamp;
        const newTimestamp = convertLocalMidnightToUTCMidnight(oldTimestamp);

        await db.collection(collectionName).updateOne({
          _id: row._id,
        }, {
          $set: {
            groupingTimestamp: newTimestamp,
          },
        });
      }
    }
  },
};

/**
 * For now days are stored
 *  21:00 of prev day
 * They will be converted to
 *  00:00 of next day
 *
 * @param ts
 * @returns {number}
 */
function convertLocalMidnightToUTCMidnight(ts) {
  const date = new Date(ts * 1000);

  date.setUTCHours(24, 0, 0, 0);

  return date.getTime() / 1000;
}
