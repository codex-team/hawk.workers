/**
 * @file Add index on `payload.release` for all per-project events collections
 * Collections pattern: `events:{projectId}` in the events database
 */
module.exports = {
  async up(db) {
    const indexSpec = { 'payload.release': 1 };
    const indexOptions = {
      name: 'payloadRelease',
      background: true,
      sparse: true,
    };

    const collections = await db.listCollections().toArray();
    const targetCollections = collections
      .map(c => c.name)
      .filter(name => name && name.startsWith('events:'));

    console.log(`Found ${targetCollections.length} events collections`);

    for (const name of targetCollections) {
      const coll = db.collection(name);
      const existing = await coll.indexes();

      const alreadyExists = existing.some(idx => idx.name === indexOptions.name) ||
        existing.some(idx => idx.key && idx.key['payload.release'] === 1);

      if (alreadyExists) {
        console.log(`Index already exists on ${name}. Skipped.`);
        continue;
      }

      console.log(`Creating index ${indexOptions.name} on ${name}...`);
      await coll.createIndex(indexSpec, indexOptions);
    }
  },

  async down(db) {
    const indexName = 'idx_payload_release';

    const collections = await db.listCollections().toArray();
    const targetCollections = collections
      .map(c => c.name)
      .filter(name => name && name.startsWith('events:'));

    console.log(`Found ${targetCollections.length} events collections`);

    for (const name of targetCollections) {
      const coll = db.collection(name);

      try {
        console.log(`Dropping index ${indexName} on ${name}...`);
        await coll.dropIndex(indexName);
      } catch (e) {
        // If index does not exist, ignore
        if (e && e.codeName !== 'IndexNotFound') {
          throw e;
        }
      }
    }
  },
};
