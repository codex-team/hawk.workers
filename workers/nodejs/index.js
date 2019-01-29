const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const debug = require('debug')('NodeJSWorker');
const { Worker } = require('../../lib/worker');
const db = require('../../db/mongoose-controller');

/**
 *
 *
 * @class NodeJSWorker
 * @extends {Worker}
 */
class NodeJSWorker extends Worker {
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
   * @param {Object} msg - Message object from consume method
   * @param {Buffer} msg.content - Message content
   * @memberof NodeJSWorker
   */
  async handle(msg) {
    const eventRaw = JSON.parse(msg.content.toString());

    let backtrace = await this.parseTrace(eventRaw.stack);

    backtrace = backtrace.map(el => {
      return { file: el.file, line: el.line }; // Take only file and line field for schema
    });

    const payload = {
      title: eventRaw.message,
      timestamp: new Date(eventRaw.time).getTime(),
      // type: eventRaw.type // TODO: request to add to schema
      backtrace,
      context: eventRaw.comment
    };

    const event = await db.saveEvent({ catcherType: 'errors/nodejs', payload });

    debug(event);
  }
}

module.exports = { NodeJSWorker };
