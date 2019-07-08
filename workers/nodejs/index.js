const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { Worker, ParsingError, DatabaseError } = require('../../lib/worker');
const db = require('../../lib/db/controller');
const { decode } = require('jsonwebtoken');

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

    let projectId;

    try {
      projectId = decode(eventRaw.token).projectId;
    } catch (err) {
      throw new ParsingError("Can't decode token", err);
    }

    const event = eventRaw.payload;

    let backtrace;

    try {
      backtrace = await this.parseTrace(event.stack);

      backtrace = backtrace.map(el => {
        return {
          file: el.file,
          line: isNaN(el.line) ? undefined : el.line
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
      timestamp = new Date(event.time).getTime();
    } catch (e) {
      throw new ParsingError('Time parsing error');
    }

    const payload = {
      title: event.message,
      timestamp,
      backtrace,
      context: event.context
    };

    const insertedId = await db.saveEvent(projectId, {
      catcherType: this.type,
      payload
    });

    this.logger.debug('Inserted event: ' + insertedId);
  }
}

module.exports = { NodeJSWorker };
