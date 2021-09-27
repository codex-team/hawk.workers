import { EventWorker } from '../../../lib/event-worker';
import * as pkg from '../package.json';
import { DefaultEventWorkerTask } from '../types/default-event-worker-task';

/**
 * Worker for handling Default events
 */
export default class DefaultEventWorker extends EventWorker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public readonly type: string = pkg.workerType;

  /**
   * Message handle function
   *
   * @param event - event to handle
   */
  public async handle(event: DefaultEventWorkerTask): Promise<void> {
    return super.handle(event);
  }
}
