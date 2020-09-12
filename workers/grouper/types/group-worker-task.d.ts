import { EventData } from 'hawk.types';
import { WorkerTask } from '../../../lib/types/worker-task';

/**
 * Language-workers adds tasks for Group Worker in this format.
 * Group Worker gets this tasks (events from language-workers) and saves it to the DB
 */
export interface GroupWorkerTask extends WorkerTask {
  /**
   * Project where error was occurred
   */
  projectId: string;

  /**
   * What type of event we've accept
   */
  catcherType: string;

  /**
   * Event that should be grouped
   */
  event: EventData;
}
