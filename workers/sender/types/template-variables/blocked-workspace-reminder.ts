import { CommonTemplateVariables } from './common-template';
import { WorkspaceDBScheme } from '@hawk.so/types';
import { Notification } from './notification';

/**
 * Variables for block workspace template
 */
export interface BlockedWorkspaceReminderTemplateVariables extends CommonTemplateVariables {
  /**
   * Blocked workspace data
   */
  workspace: WorkspaceDBScheme;

  /**
   * Number of days after payday when workspace was blocked
   */
  daysAfterPayday: number;
}

/**
 * Object with notification type and variables for the block workspace event template
 */
export interface BlockedWorkspaceReminderNotification extends Notification<BlockedWorkspaceReminderTemplateVariables> {
  /**
   * Notification when workspace blocked
   */
  type: 'blocked-workspace-reminder';

  /**
   * Notification payload
   */
  payload: BlockedWorkspaceReminderTemplateVariables;
}
