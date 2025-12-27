/**
 * Convert payload.release equal to string "null" into real null
 * across all per-project events collections (events:{projectId})
 */
module.exports = {
  async up(db) {
    const collections = await db.listCollections().toArray();
    const targetCollections = collections
      .map(c => c.name)
      .filter(name => name && name.startsWith('events:'));

    console.log(`Found ${targetCollections.length} events collections to normalize "null" string to null`);

    for (const name of targetCollections) {
      const coll = db.collection(name);

      try {
        const result = await coll.updateMany(
          { 'payload.release': 'null' },
          { $set: { 'payload.release': null } }
        );

        console.log(`[${name}] matched=${result.matchedCount}, modified=${result.modifiedCount}`);
      } catch (e) {
        console.error(`[${name}] failed to convert "null" string to null:`, e);
      }
    }
  },

  async down() {
    console.log('Down migration is not implemented: cannot reliably restore original "null" string values.');
  },
};
