import { EventDataAccepted, EventAddons } from '@hawk.so/types';
import { WorkerTask } from '../../../lib/types/worker-task';

/**
 * Data needed for NotificationWorker from GrouperWorker
 */
export type NotifierEvent = Pick<EventDataAccepted<EventAddons>, 'title'> & {
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
