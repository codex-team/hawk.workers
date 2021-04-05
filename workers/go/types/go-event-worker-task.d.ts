import { EventWorkerTask } from '../../../lib/types/event-worker-task';
import { DecodedEventData, GoAddons } from 'hawk.types';

/**
 * Describe a context passed from Go Catcher
 */
interface GoEventPayload extends DecodedEventData<GoAddons> {}

/**
 * Format of task for Go Event Worker
 */
export interface GoEventWorkerTask extends EventWorkerTask {
  /**
   * Language-specific payload
   */
  payload: GoEventPayload;
}
