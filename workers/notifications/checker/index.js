const { ObjectID } = require('mongodb');
const db = require('../../../lib/db/controller');
const { NotificationWorker, providerQueues } = require('../base');

/**
 *
 */

/**
 * @typedef {Object} ProviderSettings
 * @property {Boolean} enabled - provider enabled?
 * @property {String} value - provider hook/email/etc
 */

/**
 * @typedef {Object} NotifySettings
 * @property {ProviderSettings} email
 * @property {ProviderSettings} tg
 * @property {ProviderSettings} slack
 */

/**
 * @typedef {Object} NotifySchema
 * @property {number} actionType - action type
 * @property {string} words - words to filter when actionType is INCLUDING
 * @property {NotifySettings} settings - notify settings
 */

/**
 * Event came from grouper worker
 * @typedef {Object} GrouperEvent
 * @property {string} projectId - event's project ID
 * @property {boolean} new - New error or repetition
 * @property {string} catcherType - event type (js, golang, etc)
 * @property {object} payload - event payload
 */

/**
 * @typedef {Object} MerchantEvent
 * @property {string} userId - payer ID
 * @property {string} workspaceId - workspace ID
 * @property {number} amount - deposit amount in kopecs
 */

/**
 * @typedef {Object} NotifyCheckerEvent
 * @property {string} type - Type of event or message to process. 'event' || 'merchant'
 * @property {GrouperEvent} payload - event payload
 */

/**
 * Worker for sending notifications when event happens
 */
class NotifyCheckerWorker extends NotificationWorker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  static get type() {
    return 'notify/check';
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
   * Action types
   * @returns {{ALL: 2, ONLY_NEW: 1, INCLUDING: 3}}
   */
  static get eventActions() {
    return {
      ONLY_NEW: 1,
      ALL: 2,
      INCLUDING: 3
    };
  }

  /**
   * Notify event types
   * @returns {{EVENT: string, MERCHANT: string}}
   */
  static get notifyTypes() {
    return {
      EVENT: 'event',
      MERCHANT: 'merchant'
    };
  }

  /**
   * Check if need to send a notification about new error event and send it.
   * @param {GrouperEvent} event
   * @returns {Promise<void>}
   */
  async checkEvent(event) {
    const notifies = await this.getNotifiesByProjectId(event.projectId);
    const project = await this.getProjectById(event.projectId);

    for (const notify of notifies) {
      switch (notify.actionType) {
        case NotifyCheckerWorker.eventActions.ONLY_NEW:
          if (event.new) {
            this.logger.verbose(`Trying to send notification for notify ${JSON.stringify(notify)}\nevent ${JSON.stringify(event)}`);

            if (notify.settings.email && notify.settings.email.enabled) {
              await this.addTask(providerQueues.email, {
                to: notify.settings.email.value,
                subject: `VAM OSHIBOCHKA v ${project.name}`,
                text: `Pohozhe u vas trouble :(\n${event.payload.title}`,
                html: `<h1>Pohozhe u vas trouble :(</h1><br><code>${event.payload.title}</code>`
              });
            }

            if (notify.settings.tg && notify.settings.tg.enabled) {
              await this.addTask(providerQueues.telegram, {
                hook: notify.settings.tg.value,
                message: `<h1>Pohozhe u vas trouble v ${project.name}:(</h1><br><code>${event.payload.title}</code>`,
                parseMode: 'HTML'
              });
            }

            if (notify.settings.slack && notify.settings.slack.enabled) {
              await this.addTask(providerQueues.slack, {
                hook: notify.settings.tg.value,
                text: `Pohozhe u vas trouble v ${project.name} :(\n\`${event.payload.title}\``
              });
            }
          }
          break;
      }
    }
  }

  /**
   * Check if need to send a notification about merchant event.
   * @param event
   * @returns {Promise<void>}
   */
  async checkMerchant(event) {

  }

  /**
   * Handles event
   * @param {NotifyCheckerEvent} event
   * @returns {Promise<void>}
   */
  async handle(event) {
    switch (event.type) {
      case NotifyCheckerWorker.notifyTypes.EVENT:
        await this.checkEvent(event.payload);
        break;
      case NotifyCheckerWorker.notifyTypes.MERCHANT:
        await this.checkMerchant(event.payload);
        break;
    }
  }

  /**
   * Find all notify settings for given project ID
   * @param {string} projectId - Project ID
   * @returns {Promise<NotifySchema[]>}
   */
  async getNotifiesByProjectId(projectId) {
    const cursor = db.getConnection().collection(`notifies:${projectId}`).find({});

    return cursor.toArray();
  }

  /**
   *
   * @param projectId
   * @returns {Promise<void>}
   */
  async getProjectById(projectId) {
    return db.getConnection().collection('projects').findOne({ _id: new ObjectID(projectId) });
  }
}

module.exports = { NotifyCheckerWorker };
