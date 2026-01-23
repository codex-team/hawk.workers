/**
 * This migration creates indexes for all collections events:projectId on timestamp field
 */

/**
 * Index name for timestamp field
 */
const timestampIndexName = 'timestamp';

module.exports = {
    async up(db) {
        const collections = await db.listCollections({}, {
            authorizedCollections: true,
            nameOnly: true,
        }).toArray();

        const targetCollections = [];

        collections.forEach((collection) => {
            if (/events:/.test(collection.name)) {
                targetCollections.push(collection.name);
            }
        });

        console.log(`${targetCollections.length} events collections will be updated.`);

        let currentCollectionNumber = 1;

        for (const collectionName of targetCollections) {
            console.log(`${collectionName} in process.`);
            console.log(`${currentCollectionNumber} of ${targetCollections.length} in process.`);

            try {
                const hasIndexAlready = await db.collection(collectionName).indexExists(timestampIndexName);

                if (!hasIndexAlready) {
                    await db.collection(collectionName).createIndex({
                        timestamp: 1,
                    }, {
                        name: timestampIndexName,
                        sparse: true,
                        background: true,
                    });
                    console.log(`Index ${timestampIndexName} created for ${collectionName}`);
                } else {
                    console.log(`Index ${timestampIndexName} already exists for ${collectionName}`);
                }
            } catch (error) {
                console.error(`Error adding index to ${collectionName}:`, error);
            }

            currentCollectionNumber++;
        }
    },

    async down(db) {
        const collections = await db.listCollections({}, {
            authorizedCollections: true,
            nameOnly: true,
        }).toArray();

        const targetCollections = [];

        collections.forEach((collection) => {
            if (/events:/.test(collection.name)) {
                targetCollections.push(collection.name);
            }
        });

        console.log(`${targetCollections.length} events collections will be updated.`);

        let currentCollectionNumber = 1;

        for (const collectionName of targetCollections) {
            console.log(`${collectionName} in process.`);
            console.log(`${currentCollectionNumber} of ${targetCollections.length} in process.`);

            try {
                const hasIndexAlready = await db.collection(collectionName).indexExists(timestampIndexName);

                if (hasIndexAlready) {
                    await db.collection(collectionName).dropIndex(timestampIndexName);
                    console.log(`Index ${timestampIndexName} dropped for ${collectionName}`);
                } else {
                    console.log(`Index ${timestampIndexName} does not exist for ${collectionName}, skipping drop.`);
                }
            } catch (error) {
                console.error(`Error dropping index from ${collectionName}:`, error);
            }

            currentCollectionNumber++;
        }
    }
};
