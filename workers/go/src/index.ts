import { DatabaseController } from '../../../lib/db/controller';
import { EventWorker } from '../../../lib/event-worker';
import * as WorkerNames from '../../../lib/workerNames';
import { GroupWorkerTask } from '../../grouper/types/group-worker-task';
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
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    await super.finish();
  }

  /**
   * Message handle function
   *
   * @param event - event to handle
   */
  public async handle(event: GoEventWorkerTask): Promise<void> {
    await this.addTask(WorkerNames.GROUPER, {
      projectId: event.projectId,
      catcherType: this.type,
      event: event.payload,
    } as GroupWorkerTask);
  }
}
