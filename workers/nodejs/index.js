const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { EventWorker } = require('../../lib/event-worker');
const { ParsingError } = require('../../lib/worker');
const db = require('../../lib/db/controller');

/**
 * Worker for handling Node.js events
 */
class NodejsEventWorker extends EventWorker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   *
   * @returns {string}
   */
  static get type() {
    return 'errors/nodejs';
  }

  /**
   * Start consuming messages
   *
   * @returns {Promise<void>}
   */
  async start() {
    await db.connect(process.env.EVENTS_DB_NAME);

    await super.start();
  }

  /**
   * Finish everything
   *
   * @returns {Promise<void>}
   */
  async finish() {
    await super.finish();
    await db.close();
  }

  /**
   * @typedef {object} ParsedLine
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
    const parseRegexp = /at (.*) \((.*)\)/gm;

    const parsed = [];
    let match;

    while ((match = parseRegexp.exec(trace)) !== null) {
      let [file, line, pos] = match[2].split(':');

      line = parseInt(line);
      pos = parseInt(pos);

      parsed.push({
        func: match[1],
        file,
        line,
        pos,
      });
    }

    return parsed;
  }

  /**
   * Message handle function
   *
   * @override
   * @param {object} msg - Message object from consume method
   * @param {Buffer} msg.content - Message content
   */
  async handle(msg) {
    let eventRaw;

    try {
      eventRaw = JSON.parse(msg.content.toString());
    } catch (e) {
      throw new ParsingError('Message parsing error');
    }

    const projectId = msg.projectId;

    const event = eventRaw.payload;

    let backtrace;

    try {
      backtrace = await NodejsEventWorker.parseTrace(event.stack);

      backtrace = backtrace.map(el => {
        return {
          file: el.file,
          line: isNaN(el.line) ? undefined : el.line,
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
      context: event.context,
    };

    const insertedId = await db.saveEvent(projectId, {
      catcherType: NodejsEventWorker.type,
      payload,
    });

    NodejsEventWorker.logger.debug('Inserted event: ' + insertedId);
  }
}

module.exports = { NodejsEventWorker };
