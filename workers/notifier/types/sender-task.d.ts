import { WorkerTask } from '../../../lib/types/worker-task';
import { BufferData } from '../src/buffer';

/**
 * Interface describes task for notifications` senders workers
 */
export interface SenderWorkerEventTask extends WorkerTask {
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

/**
 * Interface describes personal notifications
 */
export interface SenderWorkerPersonalTask {
  /**
   * Project event related to
   */
  projectId: string;

  /**
   * ID of the user assigned to this event
   */
  assigneeId: string;

  /**
   * Total count of current event
   */
  totalCount: number;
  
  /**
   * Number of repetitions
   */
  repeating: number;

  /**
   * How many users were affected
   */
  usersAffected: number;
}

export type SenderWorkerTask = SenderWorkerEventTask | SenderWorkerPersonalTask;