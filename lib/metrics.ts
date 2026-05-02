import * as client from 'prom-client';
import * as http from 'http';
import createLogger from './logger';

const register = new client.Registry();
const logger = createLogger();

const DEFAULT_METRICS_HOST = '0.0.0.0';
const DEFAULT_METRICS_PATH = '/metrics';
const MIN_PORT = 1;
const MAX_PORT = 65535;
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_INTERNAL_SERVER_ERROR = 500;

let metricsServer: http.Server | null = null;
let currentWorkerName = '';

client.collectDefaultMetrics({ register });

export { register, client };

/**
 * Parse metrics endpoint port from environment.
 */
function getMetricsPort(): number | null {
  const rawPort = process.env.PROMETHEUS_METRICS_PORT;

  if (!rawPort) {
    return null;
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    logger.warn(`[metrics] invalid PROMETHEUS_METRICS_PORT="${rawPort}"; expected an integer between ${MIN_PORT} and ${MAX_PORT}`);

    return null;
  }

  return port;
}

/**
 * Read metrics endpoint path from environment.
 */
function getMetricsPath(): string {
  const rawPath = process.env.PROMETHEUS_METRICS_PATH;

  if (!rawPath) {
    return DEFAULT_METRICS_PATH;
  }

  const path = rawPath.trim();

  if (!path) {
    logger.warn(`[metrics] invalid PROMETHEUS_METRICS_PATH="${rawPath}", fallback to ${DEFAULT_METRICS_PATH}`);

    return DEFAULT_METRICS_PATH;
  }

  if (!path.startsWith('/')) {
    const normalizedPath = `/${path}`;

    logger.warn(`[metrics] normalized PROMETHEUS_METRICS_PATH from "${rawPath}" to "${normalizedPath}"`);

    return normalizedPath;
  }

  return path;
}

/**
 * Stop HTTP metrics endpoint.
 */
export function stopMetricsServer(): void {
  if (!metricsServer) {
    return;
  }

  const serverToStop = metricsServer;
  const stoppedWorkerName = currentWorkerName;

  if (!serverToStop.listening) {
    logger.info(`[metrics] endpoint already stopped for worker=${stoppedWorkerName}`);

    if (metricsServer === serverToStop) {
      metricsServer = null;
      currentWorkerName = '';
    }

    return;
  }

  serverToStop.close((error) => {
    if (error) {
      logger.error(`[metrics] failed to stop endpoint for worker=${stoppedWorkerName}: ${error.message}`);

      return;
    }

    if (metricsServer === serverToStop) {
      metricsServer = null;
      currentWorkerName = '';
    }

    logger.info(`[metrics] stopped endpoint for worker=${stoppedWorkerName}`);
  });
}

/**
 * Start HTTP metrics endpoint for scraper-based monitoring.
 *
 * @param workerName - name of the worker for default metric labels.
 */
export function startMetricsServer(workerName: string): () => void {
  const port = getMetricsPort();

  if (!port) {
    return stopMetricsServer;
  }

  if (metricsServer) {
    logger.warn(`[metrics] endpoint is already started for worker=${currentWorkerName}, skip duplicate start for worker=${workerName}`);

    return stopMetricsServer;
  }

  const host = process.env.PROMETHEUS_METRICS_HOST || DEFAULT_METRICS_HOST;
  const path = getMetricsPath();

  register.setDefaultLabels({ worker: workerName });

  const server = http.createServer(async (request, response) => {
    const requestPath = request.url?.split('?')[0];

    if (requestPath === '/-/healthy') {
      response.writeHead(HTTP_OK, { 'Content-Type': 'text/plain' });
      response.end('ok');

      return;
    }

    if (request.method !== 'GET' || requestPath !== path) {
      response.writeHead(HTTP_NOT_FOUND, { 'Content-Type': 'text/plain' });
      response.end('not found');

      return;
    }

    try {
      response.writeHead(HTTP_OK, { 'Content-Type': register.contentType });
      response.end(await register.metrics());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      logger.error(`[metrics] failed to render metrics: ${message}`);
      response.writeHead(HTTP_INTERNAL_SERVER_ERROR, { 'Content-Type': 'text/plain' });
      response.end('metrics error');
    }
  });

  server.on('error', (error) => {
    logger.error(`[metrics] endpoint error for worker=${workerName}: ${error.message}`);

    if (metricsServer === server) {
      metricsServer = null;
      currentWorkerName = '';
    }
  });

  metricsServer = server;
  currentWorkerName = workerName;

  server.listen(port, host, () => {
    logger.info(`[metrics] endpoint started for worker=${workerName} at http://${host}:${port}${path}`);
  });

  return stopMetricsServer;
}
