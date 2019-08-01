const { Worker, ParsingError } = require('../../lib/worker');
const db = require('../../lib/db/controller');
const jwt = require('jsonwebtoken');

/**
 * Worker for handling Javascript events
 */
class JavascriptWorker extends Worker {
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
    await db.connect();

    await super.start();
  }

  /**
   * Finish everything
   */
  async finish() {
    await Promise.all([super.finish(), db.close()]);
  }

  /**
   * @typedef {Object} ParsedLine
   * @property {string} [file] - Error file path
   * @property {string} [func] - Error function
   * @property {number} [line] - Error line number
   * @property {number} [pos] - Error position on line
   */

  /**
   * Parses error trace
   *
   * @param {string} trace - Raw NodeJS error trace
   * @returns {ParsedLine[]} - Parsed trace
   */
  static async parseTrace(trace) {
    return [];
  }

  /**
   * Message handle function
   *
   * @override
   * @param {Object} event - Message object from consume method
   */
  static async handle(event) {
    // let projectId;
    //
    // try {
    //   projectId = jwt.verify(eventRaw.token, process.env.JWT_SECRET).projectId;
    // } catch (err) {
    //   throw new ParsingError('Can\'t decode token', err);
    // }
    //
    // const event = eventRaw.payload;
    //
    // let backtrace;
    //
    // try {
    //   backtrace = await JavascriptWorker.parseTrace(event.stack);
    //
    //   backtrace = backtrace.map(el => {
    //     return {
    //       file: el.file,
    //       line: isNaN(el.line) ? undefined : el.line
    //     };
    //   });
    // } catch (e) {
    //   throw new ParsingError('Stack parsing error');
    // }
    //
    // let timestamp;
    //
    // try {
    //   timestamp = new Date(event.timestamp).getTime();
    // } catch (e) {
    //   throw new ParsingError('Time parsing error');
    // }
    //
    // const payload = {
    //   title: event.message,
    //   timestamp,
    //   backtrace,
    //   context: event.context
    // };

    const payload = {
      title: 'lol',
      timestamp: new Date(),
      backtrace: {},
      context: {}
    };
    // const insertedId = await db.saveEvent(projectId, {
    //   catcherType: JavascriptWorker.type,
    //   payload
    // });
    //
    // this.logger.debug('Inserted event: ' + insertedId);
  }
}

module.exports = {JavascriptWorker};
