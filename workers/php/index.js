const { Worker } = require('../../lib/worker');
const db = require('../../lib/db/mongoose-controller');
const path = require('path');

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
    let phpError;

    if (msg && msg.content) {
      try {
        phpError = JSON.parse(msg.content.toString());
      } catch (err) {
        phpError = null;
      }

      if (phpError === null) {
        return;
      }

      let data = this.parseData(phpError);

      try {
        await this._saveToDataBase(data);
      } catch (err) {
        // @todo Send unprocessed msg back to queue?
        console.log('Error saving PhpWorker payload', err);
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
    let payload = { };

    payload.title = obj['error_description'] || '';

    payload.level = -1;

    if (obj['http_params'] && obj['http_params']['REQUEST_TIME']) {
      payload.timestamp = obj['http_params']['REQUEST_TIME'];
    } else {
      payload.timestamp = (new Date()).getTime();
    }

    if (obj['debug_backtrace'] && obj['debug_backtrace'].length) {
      payload.backtrace = [];
      obj['debug_backtrace'].forEach((item) => {
        if (item.file && item.line) {
          payload.backtrace.push({
            file: item.file,
            line: item.line,
            sourceCode: (item.trace && item.trace.length) ? item.trace : []
          });
        }
      });
    }

    return payload;
  }

  /**
   * Saving to DB function
   *
   * @param {Object} payload - Object to save
   * @returns {Promise}
   */
  _saveToDataBase(payload) {
    return db.saveEvent({ catcherType: this.type, payload });
  }
}

module.exports = { PhpWorker };