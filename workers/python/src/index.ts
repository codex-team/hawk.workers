import { EventWorker } from '../../../lib/event-worker';
import * as pkg from '../package.json';
import { PythonEventWorkerTask } from '../types/python-event-worker-task';

/**
 * Worker for handling Python events
 */
export default class PythonEventWorker extends EventWorker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public readonly type: string = pkg.workerType;

  /**
   * Message handle function
   *
   * @param event - event to handle
   */
  public async handle(event: PythonEventWorkerTask): Promise<void> {
    return super.handle(event);
  }
}
