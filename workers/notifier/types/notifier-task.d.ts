import { EventData } from '../../../lib/types/event-worker-task';
import { WorkerTask } from '../../../lib/types/worker-task';

/**
 * Data needed for NotificationWorker from GrouperWorker
 */
type NotifierEvent = Pick<EventData, 'title'> & {
  /**
   * Event group hash
   */
  groupHash: string;

  /**
   * Flag to show if event is received first time
   */
  isNew: boolean;
};

/**
 * NotifierWorker task description
 */
export interface NotifierWorkerTask extends WorkerTask {
  /**
   * Project id event is related to
   */
  projectId: string;

  /**
   * Required event data
   */
  event: NotifierEvent;
}
