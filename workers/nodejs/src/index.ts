import { EventWorker } from '../../../lib/event-worker';
import * as WorkerNames from '../../../lib/workerNames';
import { GroupWorkerTask } from '../../grouper/types/group-worker-task';
import * as pkg from '../package.json';
import { NodeJSEventWorkerTask } from '../types/nodejs-event-worker-task';

/**
 * Worker for handling NodeJS events
 */
export default class NodeJSEventWorker extends EventWorker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public readonly type: string = pkg.workerType;

  /**
   * Message handle function
   *
   * @param event - event to handle
   */
  public async handle(event: NodeJSEventWorkerTask): Promise<void> {
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
   * @param {NodeJSEventWorkerTask} event - event to be validated
   */
  private validate(event: NodeJSEventWorkerTask): void {
    if (!event.projectId || !event.catcherType || !event.payload) {
      throw new Error('Bad data was given');
    }
  }
}
