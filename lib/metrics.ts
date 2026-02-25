import * as client from 'prom-client';
import os from 'os';
import { nanoid } from 'nanoid';
import createLogger from './logger';

const register = new client.Registry();
const logger = createLogger();

const DEFAULT_PUSH_INTERVAL_MS = 10_000;
const ID_SIZE = 5;
const METRICS_JOB_NAME = 'workers';

let pushInterval: NodeJS.Timeout | null = null;
let currentWorkerName = '';

client.collectDefaultMetrics({ register });

export { register, client };

/**
 * Parse push interval from environment.
 */
function getPushIntervalMs(): number {
  const rawInterval = process.env.PROMETHEUS_PUSHGATEWAY_INTERVAL;
  const parsedInterval = rawInterval === undefined
    ? DEFAULT_PUSH_INTERVAL_MS
    : Number(rawInterval);

  const interval = Number.isFinite(parsedInterval) && parsedInterval > 0
    ? parsedInterval
    : DEFAULT_PUSH_INTERVAL_MS;

  if (rawInterval !== undefined && interval !== parsedInterval) {
    logger.warn(`[metrics] invalid PROMETHEUS_PUSHGATEWAY_INTERVAL="${rawInterval}", fallback to ${DEFAULT_PUSH_INTERVAL_MS}ms`);
  }

  return interval;
}

/**
 * Stop periodic push to pushgateway.
 */
export function stopMetricsPushing(): void {
  if (!pushInterval) {
    return;
  }

  clearInterval(pushInterval);
  pushInterval = null;
  logger.info(`[metrics] stopped pushing metrics for worker=${currentWorkerName}`);
  currentWorkerName = '';
}

/**
 * Start periodic push to pushgateway.
 *
 * @param workerName - name of the worker for grouping.
 */
export function startMetricsPushing(workerName: string): () => void {
  const url = process.env.PROMETHEUS_PUSHGATEWAY_URL;

  if (!url) {
    return stopMetricsPushing;
  }

  if (pushInterval) {
    logger.warn(`[metrics] pushing is already started for worker=${currentWorkerName}, skip duplicate start for worker=${workerName}`);

    return stopMetricsPushing;
  }

  const interval = getPushIntervalMs();
  const hostname = os.hostname();
  const id = nanoid(ID_SIZE);
  const gateway = new client.Pushgateway(url, [], register);

  currentWorkerName = workerName;

  logger.info(`Start pushing metrics to ${url} every ${interval}ms (host: ${hostname}, id: ${id}, worker: ${workerName})`);

  pushInterval = setInterval(() => {
    gateway.pushAdd({
      jobName: METRICS_JOB_NAME,
      groupings: {
        worker: workerName,
        host: hostname,
        id,
      },
    }, (err) => {
      if (err) {
        logger.error(`Metrics push error: ${err.message || err}`);
      }
    });
  }, interval);

  return stopMetricsPushing;
}
