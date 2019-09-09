import {EventData, EventWorkerTask} from '../../../lib/types/event-worker-task';

/**
 * Format of task for Python Event Worker
 */
export interface PythonEventWorkerTask extends EventWorkerTask {
  /**
   * Language-specific payload
   */
  payload: PythonEventPayload;
}

/**
 * Describe a context passed from Python Catcher
 */
interface PythonEventPayload extends EventData {
  /**
   * Language-specific useful information from Python Catcher
   */
  context: PythonEventContext;
}

/**
 * Information about client
 */
interface PythonEventContext {
}
