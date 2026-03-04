/**
 * @file Prometheus metrics for dual-write to unified collections
 *
 * @see docs/mongodb-unified-collections/
 */

import promClient from 'prom-client';

export const dualWriteFailuresTotal = new promClient.Counter({
  name: 'hawk_dual_write_failures_total',
  help: 'Counter of dual-write failures to unified collections by type',
  labelNames: ['type'],
});

/**
 * Increment dual-write failure counter
 * @param type - 'events' | 'repetitions'
 */
export function incrementDualWriteFailure(type: 'events' | 'repetitions'): void {
  dualWriteFailuresTotal.labels(type).inc();
}
