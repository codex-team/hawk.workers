import { EventWorkerTask } from '../../../lib/types/event-worker-task';
import { DecodedEventData } from 'hawk.types';

/**
 * Describe a context passed from Php Catcher
 */
interface PhpEventPayload extends DecodedEventData {}

/**
 * Format of task for Php Event Worker
 */
export interface PhpEventWorkerTask extends EventWorkerTask {
  /**
   * Language-specific payload
   */
  payload: PhpEventPayload;
}
