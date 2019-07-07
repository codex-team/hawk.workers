const { Worker, ParsingError, DatabaseError } = require('../../lib/worker');
const db = require('../../lib/db/controller');
const path = require('path');
const { decode } = require('jsonwebtoken');

require('dotenv').config({ path: path.resolve(__dirname, '.', '.env') });

/**
 * Worker for saving PHP errors from catcher
 *
 * @class PhpWorker
 * @extends {Worker}
 */
class PhpWorker extends Worker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   *
   * @readonly
   * @static
   * @memberof PhpWorker
   */
  get type() {
    return 'errors/php';
  }

  /**
   * Message handle function
   *
   * @override
   * @param {Object} msg Message object from consume method
   * @param {Buffer} msg.content Message content
   * @memberof PhpWorker
   */
  async handle(msg) {
    let phpError, payload;

    if (msg && msg.content) {
      try {
        phpError = JSON.parse(msg.content.toString());
      } catch (err) {
        throw new ParsingError('Message parsing error', err);
      }

      let projectId;

      try {
        projectId = decode(phpError.token).projectId;
      } catch (err) {
        throw new ParsingError("Can't decode token", err);
      }

      try {
        payload = this.parseData(phpError.payload);
      } catch (err) {
        throw new ParsingError('Data parsing error', err);
      }

      try {
        await db.saveEvent(projectId, { catcherType: this.type, payload });
      } catch (err) {
        // @todo Send unprocessed msg back to queue?
        throw new DatabaseError('Saving event to database error', err);
      }
    }
  }

  /**
   * Start consuming messages and connect to db
   *
   * @memberof Worker
   */
  async start() {
    await db.connect();
    await super.start();
  }

  /**
   * Finish everything
   *
   * @memberof Worker
   */
  async finish() {
    await Promise.all([super.finish(), db.close()]);
  }

  /**
   * Parse php error from hawk.catcher format
   * to new universal format
   *
   * @param {Object} obj - Object to parse
   * @returns {Obejct}
   */
  parseData(obj) {
    let payload = {};

    payload.title = obj['error_description'] || '';

    // @todo откуда это брать?
    payload.level = -1;

    try {
      let timestamp = obj['http_params']['REQUEST_TIME'];

      payload.timestamp = new Date(timestamp).getTime();
    } catch (err) {
      throw new ParsingError('Time parsing error', err);
    }

    // Check optional field 'backtrace'
    if (obj['debug_backtrace'] && obj['debug_backtrace'].length) {
      payload.backtrace = [];
      obj['debug_backtrace'].forEach(item => {
        if (item.file && item.line) {
          payload.backtrace.push({
            file: item.file,
            line: item.line,
            sourceCode: item.trace && item.trace.length ? item.trace : []
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
}

module.exports = { PhpWorker };
