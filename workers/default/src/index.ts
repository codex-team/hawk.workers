import { ErrorsCatcherType } from '@hawk.so/types';
import { EventWorker } from '../../../lib/event-worker';
import * as pkg from '../package.json';
import { DefaultEventWorkerTask } from '../types/default-event-worker-task';
// eslint-disable-next-line no-unused-vars
import { catchAndReport } from '../../../lib/utils/catchAndReport';

/**
 * Worker for handling Default events
 */
export default class DefaultEventWorker extends EventWorker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public type: ErrorsCatcherType = pkg.workerType as ErrorsCatcherType;

  /**
   * Message handle function
   *
   * @param event - event to handle
   */
  @catchAndReport()
  public async handle(event: DefaultEventWorkerTask): Promise<void> {
    /**
     * Define  event type
     */
    this.type = event.catcherType;

    return super.handle(event);
  }
}
