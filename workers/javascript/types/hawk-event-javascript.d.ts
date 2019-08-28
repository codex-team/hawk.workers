import {EventData, HawkEvent} from '../../../lib/types/hawk-event';

export interface HawkEventJavascript extends HawkEvent {
  /**
   * Language-specific payload
   */
  payload: JavaScriptEventPayload;
}

/**
 * Describe a context passed from JavaScript Catcher
 */
interface JavaScriptEventPayload extends EventData {
  /**
   * Language-specific useful information from JavaScript Catcher
   */
  context: JavaScriptEventContext;
}

/**
 * Information about client
 */
interface JavaScriptEventContext {
}
