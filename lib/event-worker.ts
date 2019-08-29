import * as jwt from 'jsonwebtoken';
import { Worker } from './worker';
import { HawkEvent } from './types/hawk-event';

/**
 * Defines a Worker that handles events from Catсher.
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
  async handle(event: HawkEvent): Promise<void> {
    this.projectId = event.projectId;
  }
}

