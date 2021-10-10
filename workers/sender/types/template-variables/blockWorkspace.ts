import { CommonTemplateVariables } from './common-template';
import { WorkspaceDBScheme } from '@hawk.so/types';
import { Notification } from './notification';

/**
 * Variables for block workspace template
 */
export interface BlockWorkspaceTemplateVariables extends CommonTemplateVariables {
  /**
   * Blocked workspace data
   */
  workspace: WorkspaceDBScheme;
}

/**
 * Object with notification type and variables for the block workspace event template
 */
export interface BlockWorkspaceNotification extends Notification<BlockWorkspaceTemplateVariables> {
  /**
   * Notification when workspace blocked
   */
  type: 'block-workspace';

  /**
   * Notification payload
   */
  payload: BlockWorkspaceTemplateVariables;
}
