import * as client from 'prom-client';
import * as http from 'http';
import createLogger from './logger';

const register = new client.Registry();
const logger = createLogger();

const DEFAULT_METRICS_HOST = '0.0.0.0';
const DEFAULT_METRICS_PATH = '/metrics';
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

  return port;
}

/**
 * Read metrics endpoint path from environment.
 */
function getMetricsPath(): string {
  const path = process.env.PROMETHEUS_METRICS_PATH || DEFAULT_METRICS_PATH;

  return path;
}

/**
 * Stop HTTP metrics endpoint.
 */
export function stopMetricsServer(): void {
  if (!metricsServer) {
    return;
  }

  const stoppedWorkerName = currentWorkerName;

  metricsServer.close((error) => {
    if (error) {
      logger.error(`[metrics] failed to stop endpoint for worker=${stoppedWorkerName}: ${error.message}`);

      return;
    }

    logger.info(`[metrics] stopped endpoint for worker=${stoppedWorkerName}`);
  });

  metricsServer = null;
  currentWorkerName = '';
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

  currentWorkerName = workerName;
  register.setDefaultLabels({ worker: workerName });

  metricsServer = http.createServer(async (request, response) => {
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

  metricsServer.on('error', (error) => {
    logger.error(`[metrics] endpoint error for worker=${workerName}: ${error.message}`);
  });

  metricsServer.listen(port, host, () => {
    logger.info(`[metrics] endpoint started for worker=${workerName} at http://${host}:${port}${path}`);
  });

  return stopMetricsServer;
}
