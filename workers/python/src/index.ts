import { DatabaseController } from '../../../lib/db/controller';
import { EventWorker } from '../../../lib/event-worker';
import * as WorkerNames from '../../../lib/workerNames';
import { GroupWorkerTask } from '../../grouper/types/group-worker-task';
import * as pkg from '../package.json';
import { PythonEventWorkerTask} from '../types/python-event-worker-task';

/**
 * Worker for handling Python events
 */
export default class PythonEventWorker extends EventWorker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public readonly type: string = pkg.workerType;

  /**
   * Database Controller
   */
  private db: DatabaseController = new DatabaseController();

  constructor() {
    super();
  }

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.db.connect();
    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    await super.finish();
    await this.db.close();
  }

  /**
   * Message handle function
   */
  public async handle(event: PythonEventWorkerTask): Promise<void> {
    await super.handle(event);

    await this.addTask(WorkerNames.GROUPER, {
      projectId: this.projectId,
      catcherType: this.type,
      event: event.payload,
    } as GroupWorkerTask);
  }
}
