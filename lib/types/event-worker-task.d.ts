import { WorkerTask } from './worker-task';
import { DecodedEventData, EventAddons } from 'hawk.types';

/**
 * Format of task that handled by Event Workers
 */
export interface EventWorkerTask extends WorkerTask {
  /**
   * User project's id extracted from Integration Token
   */
  projectId: string;

  /**
   * Hawk Catcher name
   */
  catcherType: string;

  /**
   * All information about the event
   */
  payload: DecodedEventData<EventAddons>;
}