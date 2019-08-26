const dotenv = require('dotenv');
const path = require('path');
const { ObjectID } = require('mongodb');
const db = require('../../../lib/db/controller');
const { NotificationWorker, ParamError, providerQueues } = require('../base');

// Local config
dotenv.config({ path: path.resolve(__dirname, '/.env') });

// Global config
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

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
 * @property {ObjectID} _id - notify ID
 * @property {ObjectID} userId - user ID
 * @property {number} actionType - action type
 * @property {NotifySettings} settings - notify settings
 */

/**
 * @typedef {Object} NotifyCheckerEvent
 * @param {string} projectId - event's project ID
 * @param {boolean} new - New error or repetition
 * @param {string} catcherType - event type (js, golang, etc)
 * @param {object} payload - event payload
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
   * Action types
   * @returns {{ALL: number, ONLY_NEW: number, INCLUDING: number}}
   */
  static get actions() {
    return {
      ONLY_NEW: 1,
      ALL: 2,
      INCLUDING: 3
    };
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
   * Handles event
   * @param {NotifyCheckerEvent} event
   * @returns {Promise<void>}
   */
  async handle(event) {
    const notifies = await this.getNotifiesByProjectId(event.projectId);
    const project = await this.getProjectById(event.projectId);

    for (const notify of notifies) {
      switch (notify.actionType) {
        case this.actions.ONLY_NEW:
          if (event.new) {
            if (notify.settings.email && notify.settings.email.enabled) {
              await this.addTask(providerQueues.email, {
                to: notify.settings.email.value,
                subject: 'VAM OSHIBOCHKA',
                text: `Pohozhe u vas trouble :(\n${event.payload.title}`,
                html: `<h1>Pohozhe u vas trouble :(</h1><br><code>${event.payload.title}</code>`
              });
            }

            if (notify.settings.tg && notify.settings.tg.enabled) {
              await this.addTask(providerQueues.telegram, {
                hook: notify.settings.tg.value,
                message: `<h1>Pohozhe u vas trouble :(</h1><br><code>${event.payload.title}</code>`,
                parseMode: 'HTML'
              });
            }

            if (notify.settings.slack && notify.settings.slack.enabled) {
              await this.addTask(providerQueues.slack, {
                hook: notify.settings.tg.value,
                text: `Pohozhe u vas trouble :(\n\`${event.payload.title}\``
              });
            }
          }
          break;
      }
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
