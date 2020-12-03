import { EventWorkerTask } from '../../../lib/types/event-worker-task';
import { DecodedEventData } from 'hawk.types';

/**
 * Format of task for Go Event Worker
 */
export interface GoEventWorkerTask extends EventWorkerTask {
  /**
   * Language-specific payload
   */
  payload: GoEventPayload;
}

/**
 * Describe a context passed from Go Catcher
 */
interface GoEventPayload extends DecodedEventData {}
