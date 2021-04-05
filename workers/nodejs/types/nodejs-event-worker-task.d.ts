import { EventWorkerTask } from '../../../lib/types/event-worker-task';
import { DecodedEventData, NodeJSAddons } from 'hawk.types';

/**
 * Describe a context passed from NodeJS Catcher
 */
interface NodeJSEventPayload extends DecodedEventData<NodeJSAddons> {}

/**
 * Format of task for NodeJS Event Worker
 */
export interface NodeJSEventWorkerTask extends EventWorkerTask {
  /**
   * Language-specific payload
   */
  payload: NodeJSEventPayload;
}
