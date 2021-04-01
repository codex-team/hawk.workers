import { EventWorkerTask } from '../../../lib/types/event-worker-task';
import { DecodedEventData, JavaScriptAddons } from 'hawk.types';

export interface ExtendedJavaScriptAddons extends JavaScriptAddons {
  beautifiedUserAgent?: {
    os: string;
    osVersion: string;
    browser: string;
    browserVersion: string;
  }
}

/**
 * Describe a context passed from JavaScript Catcher
 */
interface JavaScriptEventPayload extends DecodedEventData<ExtendedJavaScriptAddons> {}

/**
 * Format of task for JavaScript Event Worker
 */
export interface JavaScriptEventWorkerTask extends EventWorkerTask {
  /**
   * Language-specific payload
   */
  payload: JavaScriptEventPayload;
}
