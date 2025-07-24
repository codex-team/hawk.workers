import { Worker } from './worker';
import * as WorkerNames from './workerNames';
import { GroupWorkerTask } from 'hawk-worker-grouper/types/group-worker-task';
import { CatcherMessageType, CatcherMessagePayload, CatcherMessageAccepted, ErrorsCatcherType } from '@hawk.so/types';

/**
 * Defines a Worker that handles events from Catcher.
 * Used for the common language-workers that require no specific logic (source maps consuming etc). Other workers can override `handle()` method
 */
export abstract class EventWorker extends Worker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   * 'errors/nodejs' for example
   */
  public type: ErrorsCatcherType;

  /**
   * Message handle function
   *
   * @param {CatcherMessageAccepted<CatcherMessageType>} task - worker task to handle
   */
  public async handle(task: CatcherMessageAccepted<CatcherMessageType>): Promise<void> {
    this.validate(task);

    await this.addTask(WorkerNames.GROUPER, {
      projectId: task.projectId,
      catcherType: this.type as CatcherMessageType,
      payload: task.payload as CatcherMessagePayload<ErrorsCatcherType>,
      timestamp: task.timestamp,
    } as GroupWorkerTask<ErrorsCatcherType>);
  }

  /**
   * Validate passed event data
   *
   * @param {CatcherMessageAccepted<CatcherMessageType>} task - task to be validated
   */
  protected validate(task: CatcherMessageAccepted<CatcherMessageType>): void {
    if (!task.projectId || !task.payload || !task.timestamp) {
      throw new Error('Bad data was given');
    }
  }
}
