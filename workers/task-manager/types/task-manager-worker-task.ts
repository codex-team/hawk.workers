import { WorkerTask } from '../../../lib/types/worker-task';

/**
 * TaskManagerWorker task description
 */
export interface TaskManagerWorkerTask extends WorkerTask {
  /**
   * Task type
   */
  type: 'auto-task-creation';
}
