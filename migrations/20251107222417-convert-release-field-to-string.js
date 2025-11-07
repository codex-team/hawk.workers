/**
 * Convert all payload.release fields to strings across all per-project events collections.
 * Collections pattern: events:{projectId}
 */
module.exports = {
  async up(db) {
    const collections = await db.listCollections().toArray();
    const targetCollections = collections
      .map(c => c.name)
      .filter(name => name && name.startsWith('events:'));

    console.log(`Found ${targetCollections.length} events collections to process`);

    for (const name of targetCollections) {
      const coll = db.collection(name);

      // Find docs where payload.release exists
      const cursor = coll.find(
        { 'payload.release': { $exists: true } },
        {
          projection: {
            _id: 1,
            'payload.release': 1,
          },
        }
      );

      let converted = 0;
      let scanned = 0;
      const ops = [];
      const BATCH_SIZE = 1000;

      while (await cursor.hasNext()) {
        const doc = await cursor.next();

        scanned++;
        const releaseValue = doc && doc.payload ? doc.payload.release : undefined;

        if (typeof releaseValue !== 'string') {
          ops.push({
            updateOne: {
              filter: { _id: doc._id },
              update: { $set: { 'payload.release': String(releaseValue) } },
            },
          });
          converted++;
        }

        if (ops.length >= BATCH_SIZE) {
          await coll.bulkWrite(ops, { ordered: false });
          ops.length = 0;
        }
      }

      if (ops.length > 0) {
        await coll.bulkWrite(ops, { ordered: false });
      }

      console.log(`[${name}] scanned=${scanned}, converted=${converted}`);
    }
  },

  async down() {
    console.log('Down migration is not implemented: cannot reliably restore original non-string types for payload.release.');
  },
};
