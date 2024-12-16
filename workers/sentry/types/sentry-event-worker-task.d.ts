import { WorkerTask } from '../../../lib/types/worker-task';

/**
 * Format of task for Sentry Event Worker
 */
export interface SentryEventWorkerTask extends WorkerTask {
  /**
   * Sentry-specific payload
   */
  payload: {
    envelope: string;
  };
  projectId: string;
  catcherType: 'errors/sentry';
}
