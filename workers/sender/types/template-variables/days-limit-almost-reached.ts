import { CommonTemplateVariables } from './common-template';
import { WorkspaceDBScheme } from 'hawk.types';
import { Notification } from './notification';

/**
 * Variables for days limit is almost reached template
 */
export interface DaysLimitAlmostReachedTemplateVariables extends CommonTemplateVariables {
  /**
   * Blocked workspace data
   */
  workspace: WorkspaceDBScheme;

  /**
   * Number of days left
   */
  daysLeft: number
}

/**
 * Object with notification type and variables for the days limit is almost reached event template
 */
export interface DaysLimitAlmostReachedNotification extends Notification<DaysLimitAlmostReachedTemplateVariables> {
  /**
   * Notification when days limit is almost reached
   */
  type: 'days-limit-almost-reached';

  /**
   * Notification payload
   */
  payload: DaysLimitAlmostReachedTemplateVariables;
}
