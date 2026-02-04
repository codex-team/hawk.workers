import * as client from 'prom-client';
import os from 'os';
import { nanoid } from 'nanoid';

const register = new client.Registry();

client.collectDefaultMetrics({ register });

export { register, client };

/**
 * Start periodic push to pushgateway
 *
 * @param workerName - name of the worker for grouping
 */
export function startMetricsPushing(workerName: string): void {
  const url = process.env.PROMETHEUS_PUSHGATEWAY_URL;
  const interval = parseInt(process.env.PROMETHEUS_PUSHGATEWAY_INTERVAL || '10000');

  if (!url) {
    return;
  }

  const hostname = os.hostname();
  const ID_SIZE = 5;
  const id = nanoid(ID_SIZE);

  const gateway = new client.Pushgateway(url, [], register);

  console.log(`Start pushing metrics to ${url} every ${interval}ms (host: ${hostname}, id: ${id})`);

  setInterval(() => {
    gateway.pushAdd({ jobName: 'workers', groupings: { worker: workerName, host: hostname, id } }, (err) => {
      if (err) {
        console.error('Metrics push error:', err);
      }
    });
  }, interval);
}
