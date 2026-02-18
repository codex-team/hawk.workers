import https from 'https';
import http from 'http';
import { createLogger, format, Logger, transports } from 'winston';
import { WebhookDelivery } from '../types/template';
import { HttpStatusCode, MS_IN_SEC } from '../../../lib/utils/consts';

/**
 * Timeout for webhook delivery in milliseconds
 */
const DELIVERY_TIMEOUT_MS = MS_IN_SEC * 10;

/**
 * Deliverer sends JSON POST requests to external webhook endpoints.
 *
 * SSRF validation is performed at the API layer when the endpoint is saved —
 * this class trusts the stored URL and only handles delivery.
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
   * Sends webhook delivery to the endpoint via HTTP POST.
   * Adds X-Hawk-Notification header with the notification type (similar to GitHub's X-GitHub-Event).
   *
   * @param endpoint - URL to POST to
   * @param delivery - webhook delivery { type, payload }
   */
  public async deliver(endpoint: string, delivery: WebhookDelivery): Promise<void> {
    const body = JSON.stringify(delivery);
    const url = new URL(endpoint);
    const transport = url.protocol === 'https:' ? https : http;

    return new Promise<void>((resolve) => {
      const req = transport.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Hawk-Webhook/1.0',
            'X-Hawk-Notification': delivery.type,
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: DELIVERY_TIMEOUT_MS,
        },
        (res) => {
          res.resume();

          const status = res.statusCode || 0;

          if (status >= HttpStatusCode.MultipleChoices && status <= HttpStatusCode.PermanentRedirect) {
            this.logger.log('error', `Webhook blocked — redirect ${status} to ${res.headers.location} from ${endpoint}`);
            resolve();

            return;
          }

          if (status >= HttpStatusCode.BadRequest) {
            this.logger.log('error', `Webhook delivery failed: ${status} ${res.statusMessage} for ${endpoint}`);
          }

          resolve();
        }
      );

      req.on('error', (e) => {
        this.logger.log('error', `Can't deliver webhook to ${endpoint}: ${e.message}`);
        resolve();
      });

      req.on('timeout', () => {
        this.logger.log('error', `Webhook delivery timed out for ${endpoint}`);
        req.destroy();
        resolve();
      });

      req.write(body);
      req.end();
    });
  }
}
