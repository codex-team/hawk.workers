const axios = require('axios');
const qs = require('querystring');

const { NotificationWorker, RequestFailedError, ParamError } = require('../base');

/**
 * Telegram Codex Bot worker event format
 * @typedef {object} TelegramBotEvent
 * @property {string} hook - Telegram Codex bot hook URL
 * @property {string} message - Text to send
 * @property {string} [parseMode] - Parse mode. Markdown or HTML
 */

/**
 * Telegram notification worker
 */
class TelegramCodexBotNotificationWorker extends NotificationWorker {
  /**
   * Worker type
   * @returns {string}
   */
  static get type() {
    return 'notify/telegram';
  }

  /**
   * Handle event
   * @param {TelegramBotEvent} event
   * @returns {Promise<void>}
   */
  async handle(event) {
    try {
      await axios.post(event.hook, qs.stringify({
        message: event.message,
        // eslint-disable-next-line camelcase
        parse_mode: event.parseMode || 'Markdown'
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
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

module.exports = { TelegramCodexBotNotificationWorker };
