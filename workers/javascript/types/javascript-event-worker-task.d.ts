import { EventWorkerTask } from '../../../lib/types/event-worker-task';
import { DecodedEventData, JavaScriptAddons } from 'hawk.types';

/**
 * Describe a context passed from JavaScript Catcher
 */
interface JavaScriptEventPayload extends DecodedEventData<JavaScriptAddons> {}

/**
 * Format of task for JavaScript Event Worker
 */
export interface JavaScriptEventWorkerTask extends EventWorkerTask {
  /**
   * Language-specific payload
   */
  payload: JavaScriptEventPayload;
}
