import { EventData, EventWorkerTask } from '../../../lib/types/event-worker-task';
import { BacktraceFrame } from "../../../../catchers/nodejs/types/hawk-event";

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
interface NodeJSEventPayload extends EventData {
  /**
   * Event title
   */
  title: string;

  /**
   * Event type: TypeError, ReferenceError etc
   */
  type?: string;

  /**
   * Stack
   * From the latest call to the earliest
   */
  backtrace?: BacktraceFrame[];

  /**
   * Some useful details
   */
  addons?: object;
}
