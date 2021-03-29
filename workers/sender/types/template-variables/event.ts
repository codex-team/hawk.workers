import { DecodedGroupedEvent, ProjectDBScheme } from 'hawk.types';
import { CommonTemplateVariables } from './common-template';
import { Notification } from './notification';

/**
 * Event data
 */
export interface TemplateEventData {
  /**
   * Basic information about the event
   */
  event: DecodedGroupedEvent;

  /**
   * Number of repetitions of the event in days
   */
  daysRepeated: number;

  /**
   * How many new events have occurred
   */
  newCount: number;

  /**
   * Number of affected users for this event
   */
  usersAffected?: number;
}

/**
 * Payload for events template
 */
export interface EventsTemplateVariables extends CommonTemplateVariables {
  /**
   * Data of new events
   */
  events: TemplateEventData[];

  /**
   * Project data
   */
  project: ProjectDBScheme;

  /**
   * Minimal pause between second notification, in seconds
   */
  period: number;
}

/**
 * Object with type and template variables
 */
export interface EventNotification extends Notification<EventsTemplateVariables> {
  /**
   * Notification when the new event occured
   */
  type: 'event';

  /**
   * Notification payload
   */
  payload: EventsTemplateVariables;
}