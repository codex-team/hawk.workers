/**
 * Create compound index for all collections dailyEvents:projectId on
 * (groupingTimestamp, lastRepetitionTime, _id desc)
 */
const indexName = 'groupingTimestampAndLastRepetitionTimeAndId';

module.exports = {
    async up(db) {
        const collections = await db.listCollections({}, {
            authorizedCollections: true,
            nameOnly: true,
        }).toArray();

        const targetCollections = [];

        collections.forEach((collection) => {
            if (/dailyEvents:/.test(collection.name)) {
                targetCollections.push(collection.name);
            }
        });

        console.log(`${targetCollections.length} dailyEvents collections will be updated.`);

        let currentCollectionNumber = 1;

        for (const collectionName of targetCollections) {
            console.log(`${collectionName} in process.`);
            console.log(`${currentCollectionNumber} of ${targetCollections.length} in process.`);

            try {
                const hasIndexAlready = await db.collection(collectionName).indexExists(indexName);

                if (!hasIndexAlready) {
                    await db.collection(collectionName).createIndex({
                        groupingTimestamp: -1,
                        lastRepetitionTime: -1,
                        _id: -1,
                    }, {
                        name: indexName,
                        background: true,
                    });
                    console.log(`Index ${indexName} created for ${collectionName}`);
                } else {
                    console.log(`Index ${indexName} already exists for ${collectionName}`);
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
            if (/dailyEvents:/.test(collection.name)) {
                targetCollections.push(collection.name);
            }
        });

        console.log(`${targetCollections.length} dailyEvents collections will be updated.`);

        let currentCollectionNumber = 1;

        for (const collectionName of targetCollections) {
            console.log(`${collectionName} in process.`);
            console.log(`${currentCollectionNumber} of ${targetCollections.length} in process.`);

            try {
                const hasIndexAlready = await db.collection(collectionName).indexExists(indexName);

                if (hasIndexAlready) {
                    await db.collection(collectionName).dropIndex(indexName);
                    console.log(`Index ${indexName} dropped for ${collectionName}`);
                } else {
                    console.log(`Index ${indexName} does not exist for ${collectionName}, skipping drop.`);
                }
            } catch (error) {
                console.error(`Error dropping index from ${collectionName}:`, error);
            }

            currentCollectionNumber++;
        }
    }
};


