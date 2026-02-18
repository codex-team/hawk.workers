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
 * HTTP status codes indicating a redirect
 */
const REDIRECT_STATUS_MIN = 300;
const REDIRECT_STATUS_MAX = 399;

/**
 * Only these ports are allowed for webhook delivery
 */
const ALLOWED_PORTS: Record<string, number> = {
  'http:': 80,
  'https:': 443,
};

/**
 * Hostnames blocked regardless of DNS resolution
 */
const BLOCKED_HOSTNAMES: RegExp[] = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /\.lan$/i,
  /\.localdomain$/i,
];

/**
 * Regex patterns matching private/reserved IP ranges:
 *
 * IPv4: 0.x (current-network), 10.x, 172.16-31.x, 192.168.x (RFC1918),
 * 127.x (loopback), 169.254.x (link-local/metadata), 100.64-127.x (CGN/RFC6598),
 * 255.255.255.255 (broadcast), 224-239.x (multicast),
 * 192.0.2.x, 198.51.100.x, 203.0.113.x (documentation), 198.18-19.x (benchmarking).
 *
 * IPv6: ::1, ::, fe80 (link-local), fc/fd (ULA), ff (multicast).
 *
 * Also handles IPv4-mapped IPv6 (::ffff:A.B.C.D) and zone IDs (fe80::1%lo0).
 */
const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^255\.255\.255\.255$/,
  /^2(2[4-9]|3\d)\./,
  /^192\.0\.2\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
  /^198\.1[89]\./,
  /^::1$/,
  /^::$/,
  /^fe80/i,
  /^f[cd]/i,
  /^ff[0-9a-f]{2}:/i,
  /^::ffff:(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/i,
];

/**
 * Checks whether an IPv4 or IPv6 address belongs to a private/reserved range.
 * Handles plain IPv4, IPv6, and IPv4-mapped IPv6 (::ffff:x.x.x.x).
 *
 * @param ip - IP address string (v4 or v6)
 */
export function isPrivateIP(ip: string): boolean {
  const bare = ip.split('%')[0];

  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(bare));
}

/**
 * Checks whether a hostname is in the blocked list
 *
 * @param hostname - hostname to check
 */
function isBlockedHostname(hostname: string): boolean {
  return BLOCKED_HOSTNAMES.some((pattern) => pattern.test(hostname));
}

/**
 * Resolves hostname to all IPs, validates every one is public,
 * and returns the first safe address to pin the request to.
 * Throws if any address is private or DNS fails.
 *
 * @param hostname - hostname to resolve
 */
async function resolveAndValidate(hostname: string): Promise<string> {
  const results = await dns.promises.lookup(hostname, { all: true });

  for (const { address } of results) {
    if (isPrivateIP(address)) {
      throw new Error(`resolves to private IP ${address}`);
    }
  }

  return results[0].address;
}

/**
 * Deliverer sends JSON POST requests to external webhook endpoints.
 *
 * SSRF mitigations:
 * - Protocol whitelist (http/https only)
 * - Port whitelist (80/443 only)
 * - Hostname blocklist (localhost, *.local, *.internal, *.lan)
 * - Private IP detection for raw IPs in URL
 * - DNS resolution with `all: true` — every A/AAAA record checked
 * - Request pinned to resolved IP (prevents DNS rebinding)
 * - SNI preserved via `servername` for HTTPS
 * - Redirects explicitly rejected (3xx + Location)
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
   * Pins the connection to a validated IP to prevent DNS rebinding.
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

    const requestedPort = url.port ? Number(url.port) : ALLOWED_PORTS[url.protocol];

    if (requestedPort !== ALLOWED_PORTS[url.protocol]) {
      this.logger.log('error', `Webhook blocked — port ${requestedPort} not allowed for ${endpoint}`);

      return;
    }

    const originalHostname = url.hostname;

    if (isBlockedHostname(originalHostname)) {
      this.logger.log('error', `Webhook blocked — hostname "${originalHostname}" is in blocklist`);

      return;
    }

    if (isPrivateIP(originalHostname)) {
      this.logger.log('error', `Webhook blocked — private IP in URL: ${endpoint}`);

      return;
    }

    let pinnedAddress: string;

    try {
      pinnedAddress = await resolveAndValidate(originalHostname);
    } catch (e) {
      this.logger.log('error', `Webhook blocked — ${originalHostname} ${(e as Error).message}`);

      return;
    }

    const transport = url.protocol === 'https:' ? https : http;

    return new Promise<void>((resolve) => {
      const req = transport.request(
        {
          hostname: pinnedAddress,
          port: requestedPort,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Host': originalHostname,
            'Content-Type': 'application/json',
            'User-Agent': 'Hawk-Webhook/1.0',
            'X-Hawk-Notification': delivery.type,
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: DELIVERY_TIMEOUT_MS,
          ...(url.protocol === 'https:'
            ? { servername: originalHostname, rejectUnauthorized: true }
            : {}),
        },
        (res) => {
          res.resume();

          const status = res.statusCode || 0;

          if (status >= REDIRECT_STATUS_MIN && status <= REDIRECT_STATUS_MAX) {
            this.logger.log('error', `Webhook blocked — redirect ${status} to ${res.headers.location} from ${endpoint}`);
            resolve();

            return;
          }

          if (status >= HTTP_ERROR_STATUS) {
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
