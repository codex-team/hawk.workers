import { HawkEvent } from '../../../lib/types/hawk-event';

export interface HawkEventJavascript extends HawkEvent{
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
