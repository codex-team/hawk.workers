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
   * Project event related to
   */
  projectId: string;

  /**
   * Notification Rule id that should be used for sending
   */
  ruleId: string;

  /**
   * ID of the user assigned to this event
   */
  assigneeId: string;

  /**
   * Event id
   */
  eventId: string;

  /**
   * Id of the user who assigned this person
   */
  whoAssignedId: string;

  /**
   * Total count of current event
   */
  totalCount: number;

  /**
   * Number of repetitions
   */
  daysRepeated: number;

  /**
   * How many users were affected
   */
  usersAffected: number;
}

export type SenderWorkerTask = SenderWorkerEventPayload | SenderWorkerAssigneePayload;