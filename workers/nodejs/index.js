const path = require('path');

require('dotenv').config({path: path.resolve(__dirname, '.env')});

const { Worker } = require('../../lib/worker');

/**
 *
 *
 * @class NodeJSWorker
 * @extends {Worker}
 */
class NodeJSWorker extends Worker {
  /**
   * @typedef {Object} ParsedLine
   * @property {string} file - Error file path
   * @property {string} func - Error function
   * @property {number} line - Error line number
   * @property {number} pos - Error position on line
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
      let [
        file, line, pos
      ] = match[2].split(':');

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
    const event = {
      title: eventRaw.message,
      timestamp: new Date(eventRaw.time).getTime(),
      type: eventRaw.type,
      backtrace: this.parseTrace(eventRaw.trace),
      comment: eventRaw.comment
    };

    // TODO: Send event to db
  }
}

module.exports = { NodeJSWorker };