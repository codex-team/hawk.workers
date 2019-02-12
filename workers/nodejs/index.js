const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { Worker, ParsingError } = require('../../lib/worker');
const db = require('../../lib/db/mongoose-controller');

/**
 * @class NodeJSWorker
 * @extends {Worker}
 */
class NodeJSWorker extends Worker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   *
   * @readonly
   * @static
   * @memberof NodeJSWorker
   */
  get type() {
    return 'errors/nodejs';
  }

  /**
   * Start consuming messages
   *
   * @memberof NodeJSWorker
   */
  async start() {
    await db.connect();

    await super.start();
  }

  /**
   * Finish everything
   *
   * @memberof NodeJSWorker
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
   * @memberof NodeJSWorker
   * @returns {ParsedLine[]} - Parsed trace
   */
  async parseTrace(trace) {
    const parseRegexp = /at (.*) \((.*)\)/gm;

    let parsed = [];
    let match;

    while ((match = parseRegexp.exec(trace)) !== null) {
      let [file, line, pos] = match[2].split(':');

      line = parseInt(line);
      pos = parseInt(pos);

      parsed.push({
        func: match[1],
        file,
        line,
        pos
      });
    }

    return parsed;
  }

  /**
   * Message handle function
   *
   * @override
   * @param {Object} msg - Message object from consume method
   * @param {Buffer} msg.content - Message content
   * @memberof NodeJSWorker
   */
  async handle(msg) {
    let eventRaw;

    try {
      eventRaw = JSON.parse(msg.content.toString());
    } catch (e) {
      throw new ParsingError('Message parsing error');
    }

    let backtrace;

    try {
      backtrace = await this.parseTrace(eventRaw.stack);

      backtrace = backtrace.map(el => {
        return {
          file: el.file,
          line: el.line
          /** @todo Add nodejs specific event fields to schema */
          // func: el.func,
          // pos: el.pos
        }; // Take only file and line field for schema
      });
    } catch (e) {
      throw new ParsingError('Stack parsing error');
    }

    let timestamp;

    try {
      timestamp = new Date(eventRaw.time).getTime();
    } catch (e) {
      throw new ParsingError('Time parsing error');
    }

    const payload = {
      title: eventRaw.message,
      timestamp,
      backtrace,
      context: eventRaw.comment
    };

    await db.saveEvent({ catcherType: this.type, payload });
  }
}

module.exports = { NodeJSWorker };
