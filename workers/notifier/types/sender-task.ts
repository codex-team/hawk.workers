import { WorkerTask } from '../../../lib/types/worker-task';
import { BufferData } from '../src/buffer';

/**
 * Interface describes task for notifications` senders workers
 */
export interface SenderWorkerEventPayload extends WorkerTask {
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
export interface SenderWorkerAssigneePayload {
  /**
   * ID of the user assigned to this event
   */
  assigneeId: string;

  /**
   * Project event related to
   */
  projectId: string;

  /**
   * Event id
   */
  eventId: string;

  /**
   * Id of the user who assigned this person
   */
  whoAssignedId: string;
}

export type SenderWorkerTask = SenderWorkerEventPayload | SenderWorkerAssigneePayload;