import { EventWorkerTask } from '../../../lib/types/event-worker-task';
import { DecodedEventData, DefaultAddons } from 'hawk.types';

/**
 * Describe a context passed from Default Catcher
 */
interface DefaultEventPayload extends DecodedEventData<DefaultAddons> {}

/**
 * Format of task for Default Event Worker
 */
export interface DefaultEventWorkerTask extends EventWorkerTask {
  /**
   * Language-specific payload
   */
  payload: DefaultEventPayload;
}
