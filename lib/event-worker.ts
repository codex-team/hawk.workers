import { Worker } from './worker';
import * as WorkerNames from './workerNames';
import { GroupWorkerTask } from 'hawk-worker-grouper/types/group-worker-task';
import { EventWorkerTask } from './types/event-worker-task';

/**
 * Defines a Worker that handles events from Catcher.
 * Used to extract Project Id from Integration Token
 * and to provide some common methods.
 */
export abstract class EventWorker extends Worker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   * 'errors/nodejs' for example
   */
  public readonly type: string = '';

  /**
   * Message handle function
   *
   * @param {EventWorkerTask} event - event to handle
   */
  public async handle(event: EventWorkerTask): Promise<void> {
    this.validate(event);

    await this.addTask(WorkerNames.GROUPER, {
      projectId: event.projectId,
      catcherType: this.type,
      event: event.payload,
    } as GroupWorkerTask);
  }

  /**
   * Validate passed event data
   *
   * @param {EventWorkerTask} event - event to be validated
   */
  protected validate(event: EventWorkerTask): void {
    if (!event.projectId || !event.payload) {
      throw new Error('Bad data was given');
    }
  }
}
