import { EventWorker } from '../../../lib/event-worker';
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
    return super.handle(event);
  }
}
