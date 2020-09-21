import { EventWorkerTask } from '../../../lib/types/event-worker-task';
import { DecodedEventData } from 'hawk.types';

/**
 * Format of task for NodeJS Event Worker
 */
export interface NodeJSEventWorkerTask extends EventWorkerTask {
  /**
   * Language-specific payload
   */
  payload: NodeJSEventPayload;
}

/**
 * Describe a context passed from NodeJS Catcher
 */
interface NodeJSEventPayload extends DecodedEventData {
  /**
   * Some useful details
   */
  addons?: NodeJSEventAddons;
}

/**
 * Addons object for event
 */
interface NodeJSEventAddons {
  /** Empty yet */
  [key: string]: undefined;
}
