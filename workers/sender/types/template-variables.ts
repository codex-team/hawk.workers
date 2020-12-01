import { DecodedGroupedEvent, GroupedEventDBScheme, ProjectDBScheme, UserDBScheme } from 'hawk.types';

/**
 * Common interface for template variables
 */
export interface TemplateVariables {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Types of sender notifications
 */
export enum NotificationTypes {
  ASSIGNEE='assignee',
  EVENT='event',
  SEVERAL_EVENTS='several-events'
}

/**
 * Event data
 */
export interface TemplateEventData {
  event: DecodedGroupedEvent;
  daysRepeated: number;
  newCount: number;
  usersAffected?: number;
}

/**
 * Payload for events template
 */
export interface EventsTemplateVariables extends TemplateVariables {
  events: TemplateEventData[];
  host: string;
  hostOfStatic: string;
  project: ProjectDBScheme;
  period: number;
}

/**
 * Object with type and template variables
 */
export interface EventNotification {
  type: NotificationTypes.EVENT;
  payload: EventsTemplateVariables;
}

/**
 * Object with type and variables for template for several events
 */
export interface SeveralEventsNotification {
  type: NotificationTypes.SEVERAL_EVENTS;
  payload: EventsTemplateVariables;
}

/**
 * Variables for events template
 */
export interface AssigneeTemplateVariables extends TemplateVariables {
  host: string;
  hostOfStatic: string;
  project: ProjectDBScheme;
  event: GroupedEventDBScheme;
  whoAssigned: UserDBScheme;
  daysRepeated: number;
}

/**
 * Object with notification type and variables for the assignee event template
 */
export interface AssigneeNotification {
  type: NotificationTypes.ASSIGNEE;
  payload: AssigneeTemplateVariables;
}

/**
 * All possible notifications
 */
export type AllNotifications = EventNotification | SeveralEventsNotification | AssigneeNotification;

/**
 * All template variables
 */
export type AllTemplateVariables = EventsTemplateVariables | AssigneeTemplateVariables