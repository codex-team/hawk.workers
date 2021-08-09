import { CommonTemplateVariables } from './common-template';
import { WorkspaceDBScheme } from 'hawk.types';
import { Notification } from './notification';

/**
 * Variables for days limit is almost reached template
 */
export interface DaysLimitReachedTemplateVariables extends CommonTemplateVariables {
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
export interface DaysLimitReachedNotification extends Notification<DaysLimitReachedTemplateVariables> {
  /**
   * Notification when days limit is almost reached
   */
  type: 'days-limit-reached';

  /**
   * Notification payload
   */
  payload: DaysLimitReachedTemplateVariables;
}
