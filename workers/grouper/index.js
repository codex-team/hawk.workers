const { Worker, ParsingError } = require('../../lib/worker');
const db = require('../../lib/db/controller');
const tokenVerifierMixin = require('../../lib/mixins/tokenVerifierMixin');

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
   * @typedef {Object} ParsedLine
   * @property {string} [file] - Error file path
   * @property {string} [func] - Error function
   * @property {number} [line] - Error line number
   * @property {number} [pos] - Error position on line
   */

  /**
   * Parses error trace (not implemented yet)
   *
   * @param {string} trace - Javascript error trace
   * @returns {[]} - Parsed trace
   */
  static parseTrace(trace) {
    return [];
  }

  /**
   * Message handle function
   *
   * @override
   * @param {Object} event - Message object from consume method
   */
  async handle(event) {
    await super.handle(event);

    console.log('event');
    console.log(event);
  }
}

module.exports = { GrouperWorker };
