const indexName = 'projectId_release_unique_idx';
const collectionName = 'releases';

module.exports = {
  async up(db) {
    const pairs = await db.collection(collectionName).aggregate([
      {
        $group: {
          _id: {
            projectId: '$projectId',
            release: '$release',
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          projectId: '$_id.projectId',
          release: '$_id.release',
          count: 1,
        },
      },
    ])
      .toArray();

    console.log(`Found ${pairs.length} unique (projectId, release) pairs to process.`);

    let processed = 0;

    for (const { projectId, release, count } of pairs) {
      processed += 1;
      console.log(`[${processed}/${pairs.length}] Processing projectId=${projectId}, release=${release} (docs: ${count})`);

      try {
        const docs = await db.collection(collectionName)
          .find({
            projectId,
            release,
          }, {
            projection: {
              files: 1,
              commits: 1,
            },
          })
          .toArray();

        const filesByName = new Map();
        const commitsByHash = new Map();

        for (const doc of docs) {
          if (Array.isArray(doc.files)) {
            for (const file of doc.files) {
              /**
               * Keep first occurrence if duplicates conflict
               */
              if (file && typeof file === 'object' && file.mapFileName && !filesByName.has(file.mapFileName)) {
                filesByName.set(file.mapFileName, file);
              }
            }
          }
          if (Array.isArray(doc.commits)) {
            for (const commit of doc.commits) {
              if (commit && typeof commit === 'object' && commit.hash && !commitsByHash.has(commit.hash)) {
                commitsByHash.set(commit.hash, commit);
              }
            }
          }
        }

        const mergedFiles = Array.from(filesByName.values());
        const mergedCommits = Array.from(commitsByHash.values());

        /**
         * Replace all docs for this pair with a single consolidated doc
         */
        const ops = [
          {
            deleteMany: {
              filter: {
                projectId,
                release,
              },
            },
          },
          {
            insertOne: {
              document: {
                projectId,
                release,
                files: mergedFiles,
                commits: mergedCommits,
              },
            },
          },
        ];

        await db.collection(collectionName).bulkWrite(ops, { ordered: true });
        console.log(`Consolidated projectId=${projectId}, release=${release}: files=${mergedFiles.length}, commits=${mergedCommits.length}`);
      } catch (err) {
        console.error(`Error consolidating projectId=${projectId}, release=${release}:`, err);
      }
    }

    /**
     * Create the unique compound index
     */
    try {
      const hasIndex = await db.collection(collectionName).indexExists(indexName);

      if (!hasIndex) {
        await db.collection(collectionName).createIndex(
          {
            projectId: 1,
            release: 1,
          },
          {
            name: indexName,
            unique: true,
            background: true,
          }
        );
        console.log(`Index ${indexName} created on ${collectionName} (projectId, release unique).`);
      } else {
        console.log(`Index ${indexName} already exists on ${collectionName}.`);
      }
    } catch (err) {
      console.error(`Error creating index ${indexName} on ${collectionName}:`, err);
    }
  },

  async down(db) {
    console.log(`Dropping index ${indexName} from ${collectionName}...`);
    try {
      const hasIndex = await db.collection(collectionName).indexExists(indexName);

      if (hasIndex) {
        await db.collection(collectionName).dropIndex(indexName);
        console.log(`Index ${indexName} dropped from ${collectionName}.`);
      } else {
        console.log(`Index ${indexName} does not exist on ${collectionName}, skipping drop.`);
      }
    } catch (err) {
      console.error(`Error dropping index ${indexName} from ${collectionName}:`, err);
    }
    console.log('Down migration completed (data changes are not reverted).');
  },
};
