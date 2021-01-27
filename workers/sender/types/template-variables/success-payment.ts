import { Notification } from './notification';
import { CommonTemplateVariables } from './common-template';
import { WorkspaceDBScheme } from 'hawk.types';

export interface SuccessPaymentTemplateVariables extends CommonTemplateVariables {
  /**
   * Workspace whose balance has been replenished 
   */
  workspace: WorkspaceDBScheme;

  /**
   * Workspace balance
   */
  balance: number;
}

/**
 * Object with type and variables for template for success payment notification
 */
export interface SuccessPaymentNotification extends Notification<SuccessPaymentTemplateVariables> {
  /**
   * Notification when the balance is credited successfully 
   */
  type: 'success-payment';

  /**
   * Notification payload
   */
  payload: SuccessPaymentTemplateVariables;
}
