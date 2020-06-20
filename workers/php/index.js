const { EventWorker } = require('../../lib/event-worker');
const { ParsingError, DatabaseReadWriteError } = require('../../lib/workerErrors');
const { DatabaseController } = require('../../lib/db/controller');
const path = require('path');
const { ValidationError } = require('yup');

require('dotenv').config({ path: path.resolve(__dirname, '.', '.env') });

/**
 * Worker for saving PHP errors from catcher
 */
module.exports.PhpEventWorker = class PhpEventWorker extends EventWorker {
  /**
   * Create new instance
   */
  constructor() {
    super();

    this.type = 'errors/php';
    this.db = new DatabaseController(process.env.MONGO_EVENTS_DATABASE_URI);
  }

  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   *
   * @returns {string}
   */
  static get type() {
    return 'errors/php';
  }

  /**
   * Message handle function
   *
   * @override
   * @param {object} msg Message object from consume method
   * @param {Buffer} msg.content Message content
   */
  async handle(msg) {
    let phpError, payload;

    if (msg && msg.content) {
      try {
        phpError = JSON.parse(msg.content.toString());
      } catch (err) {
        throw new ParsingError('Message parsing error', err);
      }

      const projectId = msg.projectId;

      try {
        payload = PhpEventWorker.parseData(phpError.payload);
      } catch (err) {
        throw new ParsingError('Data parsing error', err);
      }

      try {
        await this.db.saveEvent(projectId, {
          catcherType: PhpEventWorker.type,
          payload,
        });
      } catch (err) {
        if (err instanceof ValidationError) {
          // @todo Send unprocessed msg back to queue?
          throw new DatabaseReadWriteError('Saving event to database error', err);
        }
      }
    }
  }

  /**
   * Start consuming messages and connect to db
   */
  async start() {
    await this.db.connect();
    await super.start();
  }

  /**
   * Finish everything
   */
  async finish() {
    await Promise.all([super.finish(), this.db.close()]);
  }

  /**
   * Parse php error from hawk.catcher format
   * to new universal format
   *
   * @param {object} obj - Object to parse
   * @returns {object}
   */
  static parseData(obj) {
    const payload = {};

    payload.title = obj.error_description || '';

    // @todo откуда это брать?
    payload.level = -1;

    try {
      const timestamp = obj.http_params.REQUEST_TIME;

      payload.timestamp = new Date(timestamp);
    } catch (err) {
      throw new ParsingError('Time parsing error', err);
    }

    // Check optional field 'backtrace'
    if (obj.debug_backtrace && obj.debug_backtrace.length) {
      payload.backtrace = [];
      obj.debug_backtrace.forEach(item => {
        if (item.file && item.line) {
          payload.backtrace.push({
            file: item.file,
            line: item.line,
            sourceCode: item.trace && item.trace.length ? item.trace : [],
          });

          if (!item.trace) {
            console.log('no trace found for ' + item.toString());
          }
        }
      });
    } else {
      console.log('no debug backtrace found for ' + obj.toString());
    }

    return payload;
  }
};
