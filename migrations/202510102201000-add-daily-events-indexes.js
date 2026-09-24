const groupingTimestampIndexName = 'groupingTimestamp';
const groupingTimestampAndGroupHashIndexName = 'groupingTimestampAndGroupHash';

module.exports = {
  async up(db) {
      const collections = await db.listCollections({}, {
          authorizedCollections: true,
          nameOnly: true,
        }).toArray();
    
        const targetCollections = [];
    
        collections.forEach((collection) => {
          if (/dailyEvents/.test(collection.name)) {
            targetCollections.push(collection.name);
          }
        });

        console.log(`${targetCollections.length} collections will be updated.`);

        let currentCollectionNumber = 1;

        for (const collectionName of targetCollections) {
          console.log(`${collectionName} in process.`);
          console.log(`${currentCollectionNumber} of ${targetCollections.length} in process.`);
          try {
              const hasGroupingTimestampIndexAlready = await db.collection(collectionName).indexExists(groupingTimestampIndexName);

              if (!hasGroupingTimestampIndexAlready) {
                  await db.collection(collectionName).createIndex({
                      groupingTimestamp: 1,
                  }, {
                      name: groupingTimestampIndexName,
                      sparse: true,
                      background: true,
                  });
                  console.log(`Index ${groupingTimestampIndexName} created for ${collectionName}`);
              } else {
                  console.log(`Index ${groupingTimestampIndexName} already exists for ${collectionName}`);
              }

              const hasGroupingTimestampAndGroupHashIndexAlready = await db.collection(collectionName).indexExists(groupingTimestampAndGroupHashIndexName);

              if (!hasGroupingTimestampAndGroupHashIndexAlready) {
                  await db.collection(collectionName).createIndex({
                      groupingTimestamp: 1,
                      groupHash: 1,
                  }, {
                      name: groupingTimestampAndGroupHashIndexName,
                      sparse: true,
                      background: true,
                  });
                  console.log(`Index ${groupingTimestampAndGroupHashIndexName} created for ${collectionName}`);
              } else {
                  console.log(`Index ${groupingTimestampAndGroupHashIndexName} already exists for ${collectionName}`);
              }
          } catch (error) {
              console.error(`Error adding indexes to ${collectionName}:`, error);
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
          if (/dailyEvents/.test(collection.name)) {
              targetCollections.push(collection.name);
          }
      });
      
      console.log(`${targetCollections.length} collections will be updated.`);

      let currentCollectionNumber = 1;

      for (const collectionName of targetCollections) {
          console.log(`${collectionName} in process.`);
          console.log(`${currentCollectionNumber} of ${targetCollections.length} in process.`);

          try {
              const hasGroupingTimestampIndexAlready = await db.collection(collectionName).indexExists(groupingTimestampIndexName);
              if (hasGroupingTimestampIndexAlready) {
                  await db.collection(collectionName).dropIndex(groupingTimestampIndexName);
                  console.log(`Index ${groupingTimestampIndexName} dropped for ${collectionName}`);
              } else {
                  console.log(`Index ${groupingTimestampIndexName} does not exist for ${collectionName}, skipping drop.`);
              }

              const hasGroupingTimestampAndGroupHashIndexAlready = await db.collection(collectionName).indexExists(groupingTimestampAndGroupHashIndexName);
              if (hasGroupingTimestampAndGroupHashIndexAlready) {
                  await db.collection(collectionName).dropIndex(groupingTimestampAndGroupHashIndexName);
                  console.log(`Index ${groupingTimestampAndGroupHashIndexName} dropped for ${collectionName}`);
              } else {
                  console.log(`Index ${groupingTimestampAndGroupHashIndexName} does not exist for ${collectionName}, skipping drop.`);
              }
          } catch (error) {
              console.error(`Error dropping indexes from ${collectionName}:`, error);
          }
          currentCollectionNumber++;
      }
  }
}