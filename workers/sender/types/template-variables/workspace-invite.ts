import { CommonTemplateVariables } from './common-template';
import { Notification } from './notification';

/**
 * Variables for the workspace-invite template
 */
export interface WorkspaceInviteVariables extends CommonTemplateVariables {
  /**
   * Name of the workspace to which the user was invited
   */
  workspaceName: string;

  /**
   * Link to join into workspace
   */
  inviteLink: string;
}

/**
 * Notification for the workspace-invite template
 */
export interface WorkspaceInviteNotification extends Notification<WorkspaceInviteVariables> {
  /**
   * Notification when the user was invited to a workspace
   */
  type: 'workspace-invite';

  /**
   * Notification payload
   */
  payload: WorkspaceInviteVariables;
}