const axios = require('axios');

const { NotificationWorker, RequestFailedError, ParamError } = require('../base');

/**
 * Slack worker event format
 * @typedef {object} SlackEvent
 * @property {string} hook - Slack incoming webhook URL
 * @property {string} text - Text to send
 */

/**
 * Slack notification worker
 */
class SlackNotificationWorker extends NotificationWorker {
  /**
   * Worker type
   * @returns {string}
   */
  static get type() {
    return 'notify/slack';
  }

  /**
   * Handle event
   * @param {SlackEvent} event
   * @returns {Promise<void>}
   */
  async handle(event) {
    try {
      await axios.post(event.hook, {
        text: event.text
      });
    } catch (error) {
      if (error.response || error.request) {
        /*
         * error.response:
         * The request was made and the server responded with a
         * status code that falls out of the range of 2xx
         *
         * error.request:
         * The request was made but no response was received, `error.request`
         * is an instance of XMLHttpRequest in the browser and an instance
         * of http.ClientRequest in Node.js
         *
         * Requeue message, try again.
         */
        throw new RequestFailedError('Failed to submit message or 500 received', error);
      } else {
        // Something happened in setting up the request and triggered an Error
        throw new ParamError('Failed to set up request', error);
      }
    }
  }
}

module.exports = { SlackNotificationWorker };
