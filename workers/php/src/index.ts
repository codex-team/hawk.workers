import { EventWorker } from '../../../lib/event-worker';
import * as pkg from '../package.json';
import { PhpEventWorkerTask } from '../types/php-event-worker-task';

/**
 * Worker for handling Php events
 */
export default class PhpEventWorker extends EventWorker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public readonly type: string = pkg.workerType;

  /**
   * Message handle function
   *
   * @param event - event to handle
   */
  public async handle(event: PhpEventWorkerTask): Promise<void> {
    return super.handle(event);
  }
}
