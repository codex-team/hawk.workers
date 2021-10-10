import { GroupedEventDBScheme, ProjectDBScheme, UserDBScheme } from '@hawk.so/types';
import { CommonTemplateVariables } from './common-template';
import { Notification } from './notification';

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
