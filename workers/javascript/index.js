const { Worker, ParsingError } = require('../../lib/worker');
const WorkerNames = require('../../lib/workerNames');
const tokenVerifierMixin = require('../../lib/mixins/tokenVerifierMixin');
const db = require('../../lib/db/controller');

/**
 * @typedef {object} JSEvent
 * @property {StackFrame[]} stack
 */

/**
 * @typedef {object} StackFrame
 * @see https://github.com/stacktracejs/stackframe
 * @property {string} functionName — 'funName',
 * @property {string[]} args — ['args']
 * @property {string} fileName — 'http://localhost:3000/file.js'
 * @property {number} lineNumber — 1,
 * @property {number} columnNumber — 3288,
 * @property {boolean} isEval — true,
 * @property {boolean} isNative — false,
 * @property {string} source — 'funcName@http://localhost:3000/file.js:1:3288'
 */

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
   * Message handle function
   *
   * @override
   * @param {{token: string, payload: {location: {url, origin, host, port, path}, timestamp, userAgent: {name, frame:{}}, event: {colno}}}} event - Message object from consume method
   */
  async handle(event) {
    console.log('event', event);
    await super.handle(event);

    let timestamp;

    try {
      timestamp = new Date(event.payload.timestamp);
    } catch (e) {
      throw new ParsingError('Time parsing error');
    }

    const payload = {
      title: event.payload.event.message,
      timestamp,
      backtrace: event.stack,
      context: event.context
    };

    /**
     * @todo 1. Inspect 'event' object structure
     * @todo 2. Get current error location
     * @todo 3. Pass +-5 code lines from catcher
     * @todo 4. Pass release identifier from catcher
     * @todo 5. Check for release in 'releases-js' collection
     * @todo 6. If release found, parse location, title and code by Source Maps or create a task for that.
     */

    await this.addTask(WorkerNames.GROUPER, {
      projectId: event.projectId,
      catcherType: JavascriptWorker.type,
      payload
    });


  }
}

module.exports = { JavascriptWorker };
