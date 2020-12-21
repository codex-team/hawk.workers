import { WorkerTask } from '../../../lib/types/worker-task';
import { BufferData } from 'hawk-worker-notifier/src/buffer';

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
 * Payload of an event assigning someone to resolve the issue (event)
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