const { Worker } = require('../../lib/worker');
const { ValidationError, DatabaseError } = require('../../lib/worker');
const db = require('../../lib/db/controller');
const mongodb = require('mongodb');
const utils = require('../../lib/utils');
const crypto = require('crypto');
const { eventSchema } = require('../../lib/db/models/event');

/**
 * Worker for handling Javascript events
 */
class GrouperWorker extends Worker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  static get type() {
    return 'grouper';
  }

  /**
   * Start consuming messages
   */
  async start() {
    await db.connect();
    await super.start();
  }

  /**
   * Finish everything
   */
  async finish() {
    await super.finish();
    await db.close();
  }

  /**
   * Message handle function
   *
   * @override
   * @param {Object} event - Message object from consume method
   */
  async handle(event) {
    await super.handle(event);

    const uniqueEventHash = crypto.createHmac('sha256', process.env.EVENT_SECRET)
      .update(event.catcherType + event.payload.title)
      .digest('hex');

    const uniqueEvent = await this.getEvent(event.projectId, {
      groupHash: uniqueEventHash
    });

    if (!uniqueEvent) {
      // insert new event
      await this.saveEvent(event.projectId, {
        groupHash: uniqueEventHash,
        count: 1,
        catcherType: event.catcherType,
        payload: event.payload
      });
    } else {
      // increment existed event's counter
      await this.incrementEventCounter(event.projectId, {
        groupHash: uniqueEventHash
      });

      // save event's repetitions
      const diff = utils.deepDiff(uniqueEvent.payload, event.payload);

      diff.groupHash = uniqueEventHash;
      await this.saveRepetition(event.projectId, diff);
    }

    await this.saveDailyEvents(event.projectId, uniqueEventHash);
  }

  /**
   * Returns finds event by query from project with passed ID
   *
   * @param {string|ObjectID} projectId - project's identifier
   * @param {EventSchema} query - mongo query string
   * @return {Promise<void>}
   */
  async getEvent(projectId, query) {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveEvent: Project ID is invalid or missed');
    }

    try {
      const data = db.getConnection()
        .collection(`events:${projectId}`)
        .findOne(query);

      return data;
    } catch (err) {
      throw new DatabaseError(err);
    }
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
      const insertedEvent = await db.getConnection()
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
   * @param {string|ObjectID} projectId - project's identifier
   * @param {object} eventDiff - object that contains only difference with first event
   * @return {Promise<void>}
   */
  async saveRepetition(projectId, eventDiff) {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveEvent: Project ID is invalid or missing');
    }

    try {
      const insertedRepetition = await db.getConnection()
        .collection(`repetitions:${projectId}`)
        .insertOne(eventDiff);

      return insertedRepetition.insertedId;
    } catch (err) {
      throw new DatabaseError(err);
    }
  }

  /**
   * If event in project exists this method increments counter
   *
   * @param {string|ObjectID} projectId
   * @param {EventSchema} query
   * @return {Promise<void>}
   */
  async incrementEventCounter(projectId, query) {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveEvent: Project ID is invalid or missed');
    }

    try {
      const data = await db.getConnection()
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

  /**
   * saves event at the special aggregation collection
   *
   * @param {string} projectId - project's identifier
   * @param {string} eventHash - event hash
   * @return {Promise<void>}
   */
  async saveDailyEvents(projectId, eventHash) {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveEvent: Project ID is invalid or missed');
    }

    try {
      const now = new Date();
      const day = now.getDate();
      const month = now.getMonth();

      const currentDate = [
        (day > 9 ? '' : '0') + day,
        (month > 9 ? '' : '0') + month,
        now.getFullYear()
      ].join('-');

      await db.getConnection()
        .collection(`dailyEvents:${projectId}`)
        .update(
          { groupHash: eventHash, date: currentDate },
          {
            $set: { groupHash: eventHash, currentDate: currentDate },
            $inc: { count: 1 }
          },
          { upsert: true });
    } catch (err) {
      throw new DatabaseError(err);
    }
  }
}

module.exports = { GrouperWorker };
