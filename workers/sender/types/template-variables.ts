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

/**
 * Types of sender notifications
 */
export enum NotificationTypes {
  /**
   * Notification when someone assigned a user to resolve an event
   */
  Assignee = 'assignee',

  /**
   * Notification when the new event occured
   */
  Event = 'event',

  /**
   * Notification when several events occured
   */
  SeveralEvents = 'several-events'
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
export interface EventNotification {
  /**
   * Notification type
   */
  type: NotificationTypes.Event;

  /**
   * Notification payload
   */
  payload: EventsTemplateVariables;
}

/**
 * Object with type and variables for template for several events
 */
export interface SeveralEventsNotification {
  /**
   * Notification type
   */
  type: NotificationTypes.SeveralEvents;

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
export interface AssigneeNotification {
  /**
   * Notification type
   */
  type: NotificationTypes.Assignee;

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