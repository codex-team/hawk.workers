/**
 * @file Migration for creating collections for storing events and setup indexes for them
 * The problem:
 *  not for all projects there are corresponding collections for storing events (events, repetitions, dailyEvents)
 *
 * The solution:
 *  Create necessary collections and setup indexes for them
 */
const dotenv = require('dotenv');
const path = require('path');
const mongodb = require('mongodb');

const EVENTS_GROUP_HASH_INDEX_NAME = 'groupHashUnique';
const REPETITIONS_GROUP_HASH_INDEX_NAME = 'groupHash_hashed';
const REPETITIONS_USER_ID_INDEX_NAME = 'userId';

/**
 * Read env variables
 */
dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

module.exports = {
  async up(db) {
    /**
     * Init connection to accounts DB
     */
    const connection = await mongodb.MongoClient.connect(process.env.MONGO_ACCOUNTS_DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const accountsDB = connection.db();

    /**
     * Get all projects from accounts DB
     */
    const projects = await accountsDB.collection('projects').find()
      .toArray();

    console.log(`${projects.length} projects to check`);

    /**
     * Iterate over projects to create necessary collections and indexes
     */
    await asyncForEach(projects, async (project) => {
      console.log(`Check project with _id ${project._id}`);

      if (!await isCollectionExists(db, 'events:' + project._id)) {
        console.log(`create events collection and setup indexes`);
        const projectEventsCollection = await db.createCollection('events:' + project._id);

        await projectEventsCollection.createIndex({
          groupHash: 1,
        },
        {
          unique: true,
          name: EVENTS_GROUP_HASH_INDEX_NAME,
        });
      }
      if (!await isCollectionExists(db, 'repetitions:' + project._id)) {
        console.log(`create repetitions collection and setup indexes`);
        const projectRepetitionsEventsCollection = await db.createCollection('repetitions:' + project._id);

        await projectRepetitionsEventsCollection.createIndex({
          groupHash: 'hashed',
        },
        {
          name: REPETITIONS_GROUP_HASH_INDEX_NAME,
        });

        await projectRepetitionsEventsCollection.createIndex({
          'payload.user.id': 1,
        }, {
          name: REPETITIONS_USER_ID_INDEX_NAME,
          sparse: true,
        });
      }

      if (!await isCollectionExists(db, 'dailyEvents:' + project._id)) {
        console.log(`create dailyEvents collection`);
        await db.createCollection('dailyEvents:' + project._id);
      }
    });
  },

  down() {},

};

/**
 * Asynchronous forEach function
 *
 * @param array - array to iterate
 * @param callback - callback for processing array items
 */
async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

/**
 * Returns true if collection exists in database
 *
 * @param db - database to check
 * @param collectionName - collection name to check
 */
async function isCollectionExists(db, collectionName) {
  return db.listCollections({ name: collectionName }).hasNext();
}
