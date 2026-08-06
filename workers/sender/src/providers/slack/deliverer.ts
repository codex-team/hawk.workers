import { IncomingWebhook, IncomingWebhookSendArguments } from '@slack/webhook';
import { createLogger, format, Logger, transports } from 'winston';

/**
 * Deliverer is the man who will send messages to external service
 * Separated from the provider to allow testing 'send' method
 *
 * @see https://stackoverflow.com/a/40101039/4190772
 */
export default class SlackDeliverer {
  /**
   * Logger module
   * (default level='info')
   */
  private logger: Logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports: [
      new transports.Console({
        format: format.combine(
          format.timestamp(),
          format.colorize(),
          format.simple(),
          format.printf((msg) => `${msg.timestamp} - ${msg.level}: ${msg.message}`)
        ),
      }),
    ],
  });

  /**
   * Sends message to the Slack through the Incoming Webhook app
   * https://api.slack.com/messaging/webhooks
   *
   * @param endpoint - where to send
   * @param message - what to send
   */
  public async deliver(endpoint: string, message: IncomingWebhookSendArguments): Promise<void> {
    try {
      const webhook = new IncomingWebhook(endpoint, {
        username: 'Hawk',
      });

      await webhook.send(message);
    } catch (e) {
      this.logger.log('error', 'Can\'t deliver Incoming Webhook. Slack returns an error: ', e);
    }
  }
}
