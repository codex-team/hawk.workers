import * as WorkerNames from '../../../lib/workerNames';
import { DatabaseController } from '../../../lib/db/controller';
import { HawkEventJavascript } from '../types/hawk-event-javascript';
import { EventWorker } from '../../../lib/event-worker';
import { GroupWorkerTask } from '../../grouper/types/group-worker-task';

/**
 * Worker for handling Javascript events
 */
export default class JavascriptWorker extends EventWorker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public readonly type: string = 'errors/javascript';

  /**
   * Database Controller
   */
  private db: DatabaseController = new DatabaseController();

  constructor(){
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
  public async handle(event: HawkEventJavascript): Promise<void> {
    await super.handle(event);

    /**
     * @todo 2. Get current error location
     * @todo 3. Pass +-5 code lines from catcher
     * @todo 4. Pass release identifier from catcher
     * @todo 5. Check for release in 'releases-js' collection
     * @todo 6. If release found, parse location, title and code by Source Maps or create a task for that.
     */
    await this.addTask(WorkerNames.GROUPER, {
      projectId: this.projectId,
      catcherType: this.type,
      event: event.payload
    } as GroupWorkerTask);
  }
}
