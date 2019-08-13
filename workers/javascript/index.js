const { Worker, ParsingError } = require('../../lib/worker');
const db = require('../../lib/db/controller');
const tokenVerifierMixin = require('../../lib/mixins/tokenVerifierMixin');

/**
 * Worker for handling Javascript events
 */
class JavascriptWorker extends tokenVerifierMixin(Worker) {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  static get type() {
    return 'errors/javascript';
  }

  /**
   * Start consuming messages
   */
  async start() {
    await super.start();
  }

  /**
   * Finish everything
   */
  async finish() {
    await super.finish();
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

    let backtrace;

    try {
      backtrace = await JavascriptWorker.parseTrace(event.stack);

      backtrace = backtrace.map(el => {
        return {
          file: el.file,
          line: isNaN(el.line) ? undefined : el.line
        };
      });
    } catch (e) {
      throw new ParsingError('Stack parsing error');
    }

    let timestamp;

    try {
      timestamp = new Date(event.payload.timestamp);
    } catch (e) {
      throw new ParsingError('Time parsing error');
    }

    const payload = {
      title: event.payload.event.message,
      timestamp,
      backtrace,
      context: event.context
    };

    await this.delegate({
      projectId: event.projectId,
      catcherType: JavascriptWorker.type,
      payload
    });
  }
}

module.exports = { JavascriptWorker };
