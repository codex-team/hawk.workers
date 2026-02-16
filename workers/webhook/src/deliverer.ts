import { createLogger, format, Logger, transports } from 'winston';
import { WebhookPayload } from '../types/template';

/**
 * Deliverer sends JSON POST requests to external webhook endpoints
 */
export default class WebhookDeliverer {
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
   * Sends JSON payload to the webhook endpoint via HTTP POST
   *
   * @param endpoint - URL to POST to
   * @param payload - JSON body to send
   */
  public async deliver(endpoint: string, payload: WebhookPayload): Promise<void> {
    const body = JSON.stringify(payload);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Hawk-Webhook/1.0',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        this.logger.log('error', `Webhook delivery failed: ${response.status} ${response.statusText} for ${endpoint}`);
      }
    } catch (e) {
      this.logger.log('error', `Can't deliver webhook to ${endpoint}: `, e);
    }
  }
}
