import { Notification } from './notification';
import { CommonTemplateVariables } from './common-template'
import { WorkspaceDBScheme, PlanDBScheme } from 'hawk.types'

export interface LowBalancePayload extends CommonTemplateVariables {
  /**
   * Workspace that has a low balance
   */
  workspace: WorkspaceDBScheme;

  /**
   * Workspace plan
   */
  plan: PlanDBScheme
}

/**
 * Object with type and variables for template for low balance notification
 */
export interface LowBalanceNotification extends Notification<LowBalancePayload> {
  /**
   * Notification when the user has low balance on the workspace
   */
  type: 'low-balance';

  /**
   * Notification payload
   */
  payload: LowBalancePayload;
}
