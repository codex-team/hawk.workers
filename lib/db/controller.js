const mongodb = require('mongodb');
const { eventSchema } = require('./models/event');

/**
 * Database connection singleton
 *
 * @param {mongodb.MongoClient} connection - MongoDB connection
 * @param {mongodb.Db} db - MongoDB connection database instance
 */
class Controller {
  /**
   * Connect to databse
   * Requires `MONGO_URL` environment variable to be set
   * @returns {Promise<void>}
   * @throws {Error} if `MONGO_URL` is not set
   */
  async connect() {
    if (this.connection || this.db) {
      return;
    }

    if (!process.env.MONGO_URL) {
      throw new Error('MONGO_URL env variable is not set!');
    }

    this.connection = await mongodb.connect(process.env.MONGO_URL, {
      useNewUrlParser: true
    });
    this.db = await this.connection.db();
  }

  /**
   * Close connection
   *
   * @returns {Promise<void>}
   */
  async close() {
    this.db = null;
    return this.connection.close();
  }

  /**
   * Save event to databse
   *
   * @param {string|ObjectID} projectId - project id
   * @param {eventSchema} eventData - event data
   * @returns {Promise<mongodb.ObjectID>} saved event id
   * @throws {Error} if `projectID` is not provided or invalid
   * @throws {yup.ValidationError} if `eventData` is not a valid object
   */
  async saveEvent(projectId, eventData) {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new Error('projectID is not set ot valid');
    }

    await eventSchema.validate(eventData);

    const insertedEvent = await this.db
      .collection(`events:${projectId}`)
      .insertOne(eventData);

    return insertedEvent.insertedId;
  }
}

module.exports = new Controller();
