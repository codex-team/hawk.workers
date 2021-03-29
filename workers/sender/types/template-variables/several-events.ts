import { Notification } from './notification';
import { EventsTemplateVariables } from './event';

/**
 * Object with type and variables for template for several events
 */
export interface SeveralEventsNotification extends Notification<EventsTemplateVariables> {
  /**
   * Notification when several events occured
   */
  type: 'several-events';

  /**
   * Notification payload
   */
  payload: EventsTemplateVariables;
}
