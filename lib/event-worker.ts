import {EventWorkerTask} from "./types/event-worker-task";
import {Worker} from "./worker";

/**
 * Defines a Worker that handles events from Catcher.
 * Used to extract Project Id from Integration Token and to provide some common methods.
 *
 * catherTypes -> 'error/*'
 */
export abstract class EventWorker extends Worker {
  /**
   * Id of Project that sends an event
   */
  protected projectId: string;

  /**
   * Parse JWT from 'token', extract Project Id and store it.
   */
  public async handle(event: EventWorkerTask): Promise<void> {
    this.projectId = event.projectId;
  }
}
