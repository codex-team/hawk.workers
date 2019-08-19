const { Worker } = require('../../lib/worker');
const db = require('../../lib/db/controller');
const utils = require('../../lib/utils');
const crypto = require('crypto');

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
   * Message handle function
   *
   * @override
   * @param {Object} event - Message object from consume method
   */
  async handle(event) {
    await super.handle(event);

    const uniqueEventHash = crypto.createHmac('sha256', 'hell')
      .update(event.catcherType + event.payload.title)
      .digest('hex');

    const uniqueEvent = await db.getEvent(event.projectId, {
      groupHash: uniqueEventHash
    });

    if (!uniqueEvent) {
      // insert new event
      await db.saveEvent(event.projectId, {
        groupHash: uniqueEventHash,
        count: 1,
        catcherType: event.catcherType,
        payload: event.payload
      });
    } else {
      // increment existed event's counter
      await db.incrementEventCounter(event.projectId, {
        groupHash: uniqueEventHash
      });

      // save event's repetitions
      const diff = utils.deepDiff(uniqueEvent.payload, event.payload);

      await db.saveRepetition(event.projectId, diff);
    }
  }
}

module.exports = { GrouperWorker };
