import { EventWorker } from '../../../lib/event-worker';
import * as pkg from '../package.json';
import { GoEventWorkerTask } from '../types/go-event-worker-task';

/**
 * Worker for handling Go events
 */
export default class GoEventWorker extends EventWorker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public readonly type: string = pkg.workerType;


  /**
   * Message handle function
   *
   * @param event - event to handle
   */
  public async handle(event: GoEventWorkerTask): Promise<void> {
    return super.handle(event);
  }
}
