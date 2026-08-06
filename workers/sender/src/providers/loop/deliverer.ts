import { IncomingWebhook } from '@slack/webhook';
import { createLogger, format, Logger, transports } from 'winston';

/**
 * Deliverer is the man who will send messages to external service
 * Separated from the provider to allow testing 'send' method
 * Loop is Slack-like platform, so we use Slack API to send messages.
 *
 */
export default class LoopDeliverer {
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
   * Sends message to the Loop through the Incoming Webhook app
   * https://developers.loop.ru/integrate/webhooks/incoming/
   *
   * @param endpoint - where to send
   * @param message - what to send
   */
  public async deliver(endpoint: string, message: string): Promise<void> {
    try {
      const webhook = new IncomingWebhook(endpoint, {
        username: 'Hawk',
      });

      await webhook.send(message);
    } catch (e) {
      this.logger.log('error', 'Can\'t deliver Incoming Webhook. Loop returns an error: ', e);
    }
  }
}
