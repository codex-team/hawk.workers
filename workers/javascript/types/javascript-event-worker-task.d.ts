import { EventWorkerTask } from '../../../lib/types/event-worker-task';
import { DecodedEventData } from 'hawk.types';

/**
 * Describe a context passed from JavaScript Catcher
 */
interface JavaScriptEventPayload extends DecodedEventData {}

/**
 * Format of task for JavaScript Event Worker
 */
export interface JavaScriptEventWorkerTask extends EventWorkerTask {
  /**
   * Language-specific payload
   */
  payload: JavaScriptEventPayload;
}
