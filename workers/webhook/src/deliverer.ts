import https from 'https';
import http from 'http';
import dns from 'dns';
import { createLogger, format, Logger, transports } from 'winston';
import { WebhookDelivery } from '../types/template';

/**
 * Timeout for webhook delivery in milliseconds
 */
const DELIVERY_TIMEOUT_MS = 10000;

/**
 * HTTP status code threshold for error responses
 */
const HTTP_ERROR_STATUS = 400;

/**
 * Regex patterns matching private/reserved IP ranges.
 * Covers: 0.x, 10.x, 127.x, 169.254.x, 172.16-31.x, 192.168.x, 100.64-127.x (IPv4)
 * and ::1, ::, fe80::, fc/fd ULA (IPv6).
 */
const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^::1$/,
  /^::$/,
  /^fe80/i,
  /^f[cd]/i,
];

/**
 * Checks whether an IPv4 or IPv6 address belongs to a private/reserved range.
 * Blocks loopback, link-local, RFC1918, metadata IPs and IPv6 equivalents.
 *
 * @param ip - IP address string (v4 or v6)
 */
export function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip));
}

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
   * Sends webhook delivery to the endpoint via HTTP POST.
   * Adds X-Hawk-Notification header with the notification type (similar to GitHub's X-GitHub-Event).
   *
   * @param endpoint - URL to POST to
   * @param delivery - webhook delivery { type, payload }
   */
  public async deliver(endpoint: string, delivery: WebhookDelivery): Promise<void> {
    const body = JSON.stringify(delivery);
    const url = new URL(endpoint);

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      this.logger.log('error', `Webhook blocked — unsupported protocol: ${url.protocol} for ${endpoint}`);

      return;
    }

    const hostname = url.hostname;

    if (isPrivateIP(hostname)) {
      this.logger.log('error', `Webhook blocked — private IP in URL: ${endpoint}`);

      return;
    }

    try {
      const { address } = await dns.promises.lookup(hostname);

      if (isPrivateIP(address)) {
        this.logger.log('error', `Webhook blocked — ${hostname} resolves to private IP ${address}`);

        return;
      }
    } catch (e) {
      this.logger.log('error', `Webhook blocked — DNS lookup failed for ${hostname}: ${(e as Error).message}`);

      return;
    }

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
