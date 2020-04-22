import { WorkerTask } from '../../../lib/types/worker-task';
import { BufferData } from '../src/buffer';

/**
 * Interface describes task for notifications` senders workers
 */
export interface SenderWorkerTask extends WorkerTask {
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
  events: BufferData[];
}
