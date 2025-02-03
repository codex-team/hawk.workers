import { WorkerTask } from '../../../../lib/types/worker-task';
import { SenderData } from 'hawk-worker-notifier/types/channel';

export interface SenderWorkerEventPayload {
  /**
   * Project events related to
   */
  projectId: string;

  /**
   * Notification Rule id that should be used for sending
   */
  ruleId: string;

  /**
   * Array contains events' group hashes and number of repetition for the last minPeriod
   */
  events: SenderData[];
}

/**
 * Interface describes task for notifications` senders workers
 */
export interface SenderWorkerEventTask extends WorkerTask {
  type: 'event',
  payload: SenderWorkerEventPayload
}