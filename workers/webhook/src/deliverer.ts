import https from 'https';
import http from 'http';
import { createLogger, format, Logger, transports } from 'winston';
import { WebhookPayload } from '../types/template';

/**
 * Timeout for webhook delivery in milliseconds
 */
const DELIVERY_TIMEOUT_MS = 10000;

/**
 * HTTP status code threshold for error responses
 */
const HTTP_ERROR_STATUS = 400;

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
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: DELIVERY_TIMEOUT_MS,
        },
        (res) => {
          res.resume();

          if (res.statusCode && res.statusCode >= HTTP_ERROR_STATUS) {
            this.logger.log('error', `Webhook delivery failed: ${res.statusCode} ${res.statusMessage} for ${endpoint}`);
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
