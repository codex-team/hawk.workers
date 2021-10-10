import { CommonTemplateVariables } from './common-template';
import { WorkspaceDBScheme } from '@hawk.so/types';
import { Notification } from './notification';

/**
 * Variables for events limit is almost reached template
 */
export interface EventsLimitAlmostReachedTemplateVariables extends CommonTemplateVariables {
  /**
   * Blocked workspace data
   */
  workspace: WorkspaceDBScheme;

  /**
   * Number of events Hawk got
   */
  eventsCount: number;

  /**
   * Number of events allowed by plan
   */
  eventsLimit: number;
}

/**
 * Object with notification type and variables for the events limit is almost reached event template
 */
export interface EventsLimitAlmostReachedNotification extends Notification<EventsLimitAlmostReachedTemplateVariables> {
  /**
   * Notification when events limit is almost reached
   */
  type: 'events-limit-almost-reached';

  /**
   * Notification payload
   */
  payload: EventsLimitAlmostReachedTemplateVariables;
}
