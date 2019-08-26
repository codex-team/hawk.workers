const nodemailer = require('nodemailer');
const { NotificationWorker, ParamError } = require('../base');

/**
 * Slack worker event format
 * @typedef {object} EmailEvent
 * @property {string} to - email
 * @property {string} subject - subject
 * @property {string} text - text body to send
 * @property {string} html - html body to send
 */

/**
 * Slack notification worker
 */
class EmailNotificationWorker extends NotificationWorker {
  /**
   * Worker type
   * @returns {string}
   */
  static get type() {
    return 'notify/email';
  }

  /**
   * Creates Email worker
   */
  constructor() {
    super();
    this.transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD
      }
    });

    this.senderOptions = {
      from: `"${process.env.SMTP_SENDER_NAME}" <${process.env.SMTP_SENDER_ADDRESS}>`
    };
  }

  /**
   * Handle event
   * @param {EmailEvent} event
   * @returns {Promise<void>}
   */
  async handle(event) {
    console.log(event);
    try {
      const info = await this.transport.sendMail({
        ...this.senderOptions,
        to: event.to,
        subject: event.subject,
        text: event.text,
        html: event.html
      });

      console.log(info);
    } catch (err) {
      throw new ParamError(err);
    }
  }
}

module.exports = { EmailNotificationWorker };
