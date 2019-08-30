const { Worker, DatabaseError } = require('../../lib/worker');
const db = require('../../lib/db/controller');

/**
 * @typedef {object} SourceMapsWorkerTask
 * @property {string} release - unique release identifier
 * @property {string} token - JWT from Authorisation («Bearer ...») header
 * @property {{name: string, payload: string}[]} files - Files list
 */

/**
 * This worker gets source map from the Registry
 * and puts it to Mongo
 * to provide access for it for JS Worker
 */
module.exports.SourceMapsWorker = class SourceMapsWorker extends Worker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  static get type() {
    return 'release/javascript';
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
   * Source maps will stored in this collection
   * One for all projects
   */
  get collectionName() {
    return 'releases-js';
  }

  /**
   * Message handle function
   *
   * @override
   * @param {SourceMapsWorkerTask} event - Message object from consume method
   */
  async handle(event) {
    await super.handle(event);

    const projectId = 7654321;
    const release = 1234567;

    /**
     * Save source map
     */
    this.save(null, {
      projectId,
      release,
      files: event.files
    });
  }

  /**
   * Save map file to database
   *
   * @param {string|ObjectID} projectId - project id
   * @param {EventSchema} eventData - event data
   * @returns {Promise<mongodb.ObjectID>} saved event id
   * @throws {ValidationError} if `projectID` is not provided or invalid
   * @throws {ValidationError} if `eventData` is not a valid object
   */
  async save(projectId, eventData) {
    try {
      const insertedEvent = await db.getConnection()
        .collection(this.collectionName)
        .insertOne(eventData);

      return insertedEvent.insertedId;
    } catch (err) {
      throw new DatabaseError(err);
    }
  }
};
