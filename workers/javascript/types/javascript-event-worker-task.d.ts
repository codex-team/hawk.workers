import { EventWorkerTask } from '../../../lib/types/event-worker-task';
import { DecodedEventData } from 'hawk.types';

/**
 * Format of task for JavaScript Event Worker
 */
export interface JavaScriptEventWorkerTask extends EventWorkerTask {
  /**
   * Language-specific payload
   */
  payload: JavaScriptEventPayload;
}

/**
 * Describe a context passed from JavaScript Catcher
 */
interface JavaScriptEventPayload extends DecodedEventData {
  /**
   * Language-specific useful information from JavaScript Catcher
   */
  context: JavaScriptEventContext;
}

/**
 * Information about client
 */
interface JavaScriptEventContext {
  /** Empty yet */
  [key: string]: undefined;
}
