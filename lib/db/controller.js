const mongodb = require('mongodb');
const { eventSchema } = require('./models/event');
const { ValidationError, DatabaseError } = require('../worker');

/**
 * Database connection singleton
 *
 * @param {mongodb.MongoClient} connection - MongoDB connection
 * @param {mongodb.Db} db - MongoDB connection database instance
 */
class Controller {
  /**
   * Connect to database
   * Requires `MONGO_URL` environment variable to be set
   * @returns {Promise<void>}
   * @throws {Error} if `MONGO_URL` is not set
   */
  async connect() {
    if (this.db) {
      return;
    }

    console.info('MongoDB URL: ' + process.env.MONGO_URL);

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
   * Save event to database
   *
   * @param {string|ObjectID} projectId - project id
   * @param {EventSchema} eventData - event data
   * @returns {Promise<mongodb.ObjectID>} saved event id
   * @throws {ValidationError} if `projectID` is not provided or invalid
   * @throws {ValidationError} if `eventData` is not a valid object
   */
  async saveEvent(projectId, eventData) {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveEvent: Project ID is invalid or missed');
    }

    try {
      eventData.payload.timestamp = new Date(eventData.payload.timestamp);
      await eventSchema.validate(eventData);
    } catch (err) {
      throw new ValidationError('Controller.saveEvent: ' + err);
    }

    try {
      const insertedEvent = await this.db
        .collection(`events:${projectId}`)
        .insertOne(eventData);

      return insertedEvent.insertedId;
    } catch (err) {
      throw new DatabaseError(err);
    }
  }

  /**
   * Inserts unique event repetition to the database
   *
   * @param {string|ObjectID} projectId
   * @param {object} eventDiff
   * @return {Promise<void>}
   */
  async saveRepetition(projectId, eventDiff) {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveEvent: Project ID is invalid or missing');
    }

    try {
      const insertedRepetition = await this.db
        .collection(`repetitions:${projectId}`)
        .insertOne(eventDiff);

      return insertedRepetition.insertedId;
    } catch (err) {
      throw new DatabaseError(err);
    }
  }

  /**
   * @param {string|ObjectID} projectId
   * @param {EventSchema} query
   * @return {Promise<void>}
   */
  async getEvent(projectId, query) {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveEvent: Project ID is invalid or missed');
    }

    try {
      const data = await this.db
        .collection(`events:${projectId}`)
        .findOne(query);

      return data;
    } catch (err) {
      throw new DatabaseError(err);
    }
  }

  /**
   * @param {string|ObjectID} projectId
   * @param {EventSchema} query
   * @return {Promise<void>}
   */
  async incrementEventCounter(projectId, query) {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveEvent: Project ID is invalid or missed');
    }

    try {
      const data = await this.db
        .collection(`events:${projectId}`)
        .updateOne(query, {
          $inc: {
            count: 1
          }
        });

      return data;
    } catch (err) {
      throw new DatabaseError(err);
    }
  }
}

module.exports = new Controller();
