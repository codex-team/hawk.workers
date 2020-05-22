const terminal = require('../lib/utils/terminal');

/**
 * This migration updates the groupingTimestamp fields in dailyEvents collections.
 *
 * The problem:
 *
 * The solution:
 *
 */
module.exports = {
  /**
   * Convert groupingTimestamp from local midnight to UTC midnight
   *
   * @param {Db} db - Mongo DB instance
   * @param {MongoClient} client - client that can be used for transactions
   * @returns {Promise<boolean>}
   */
  async up(db, client) {
    /**
     * Get all collection names
     */
    const collections = await db.listCollections({}, {
      authorizedCollections: true,
      nameOnly: true,
    }).toArray();

    /**
     * Get only dailyEvents collection names
     */
    const targetCollections = collections
      .filter(({ name }) => /dailyEvents/.test(name))
      .map(({ name }) => name);


    /**
     * Use one transaction for all requests
     */
    const session = client.startSession();

    console.log('Start converting dailyEvents grouping timestamp.');
    console.log(`${targetCollections.length} collections will be updated.`);

    try {
      await session.withTransaction(async () => {
        let processedItem = 0;

        for (const collectionName of targetCollections) {
          const rows = await db.collection(collectionName)
            .find({})
            .toArray();

          terminal.printProgress(
            `${processedItem} of ${targetCollections.length} processed. Current — ${terminal.wrapInColor(collectionName, terminal.consoleColors.fgGreen)} with ${rows.length} rows`
          );

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

          processedItem++;
        }
      });
    } finally {
      console.log('\n All items processed. \n');
      await session.endSession();
    }
  },

  /**
   * Convert groupingTimestamp from UTC midnight to local midnight
   *
   * @param {Db} db - Mongo DB instance
   * @param {MongoClient} client - client that can be used for transactions
   * @returns {Promise<boolean>}
   */
  async down(db, client) {
    /**
     * Get all collection names
     */
    const collections = await db.listCollections({}, {
      authorizedCollections: true,
      nameOnly: true,
    }).toArray();

    /**
     * Get only dailyEvents collection names
     */
    const targetCollections = collections
      .filter(({ name }) => /dailyEvents/.test(name))
      .map(({ name }) => name);

    /**
     * Use one transaction for all requests
     */
    const session = client.startSession();

    console.log(`Start ${terminal.wrapInColor('downgrade', terminal.consoleColors.fgRed)} converting dailyEvents grouping timestamp.`);
    console.log(`${targetCollections.length} collections will be updated.`);

    try {
      await session.withTransaction(async () => {
        let processedItem = 0;

        for (const collectionName of targetCollections) {
          const rows = await db.collection(collectionName)
            .find({})
            .toArray();

          terminal.printProgress(
            `${processedItem} of ${targetCollections.length} processed. Current — ${terminal.wrapInColor(collectionName, terminal.consoleColors.fgGreen)} with ${rows.length} rows`
          );

          for (const row of rows) {
            const oldTimestamp = row.groupingTimestamp;
            const newTimestamp = convertUTCMidnightToLocalMidnight(oldTimestamp);

            await db.collection(collectionName).updateOne({
              _id: row._id,
            }, {
              $set: {
                groupingTimestamp: newTimestamp,
              },
            });
          }

          processedItem++;
        }
      });
    } finally {
      console.log('\n All items processed. \n');
      await session.endSession();
    }
  },
};

/**
 * up:
 *
 * For now days are stored
 *  21:00 of prev day
 * They will be converted to
 *  00:00 of next day
 *
 * @param {number} ts - timestamp to convert
 * @returns {number}
 */
function convertLocalMidnightToUTCMidnight(ts) {
  const date = new Date(ts * 1000);

  date.setUTCHours(24, 0, 0, 0);

  return date.getTime() / 1000;
}

/**
 * down:
 *
 * For now days are stored
 *  00:00 of current day
 * They will be converted to
 *  21:00 of prev day
 *
 * @param {number} ts - timestamp to convert
 * @returns {number}
 */
function convertUTCMidnightToLocalMidnight(ts) {
  const date = new Date(ts * 1000);

  date.setHours(0, 0, 0, 0);

  return date.getTime() / 1000;
}
