import { DecodedGroupedEvent, GroupedEventDBScheme, ProjectDBScheme, UserDBScheme } from 'hawk.types';

/**
 * Common variables for notification templates
 */
export interface CommonTemplateVariables {
  /**
   * Api url
   */
  host: string;

  /**
   * Api url with path to static files
   */
  hostOfStatic: string;
}

export interface Notification<Payload> {
  /**
   * Notification type
   */
  type: string;

  /**
   * Notification payload
   */
  payload: Payload;
}

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

/**
 * Variables for events template
 */
export interface AssigneeTemplateVariables extends CommonTemplateVariables {
  /**
   * Project data
   */
  project: ProjectDBScheme;

  /**
   * Event data
   */
  event: GroupedEventDBScheme;

  /**
   * User who assigned this person
   */
  whoAssigned: UserDBScheme;

  /**
   * Number of event repetitions
   */
  daysRepeated: number;
}

/**
 * Object with notification type and variables for the assignee event template
 */
export interface AssigneeNotification extends Notification<AssigneeTemplateVariables> {
  /**
   * Notification when someone assigned a user to resolve an event
   */
  type: 'assignee';

  /**
   * Notification payload
   */
  payload: AssigneeTemplateVariables;
}

/**
 * Variables for notify-senders wrapped in payload with type
 */
export type AllNotifications = EventNotification | SeveralEventsNotification | AssigneeNotification;

/**
 * Template variables for notify-senders
 */
export type TemplateVariables = EventsTemplateVariables | AssigneeTemplateVariables;