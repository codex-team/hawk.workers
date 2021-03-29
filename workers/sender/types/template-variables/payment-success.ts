import { Notification } from './notification';
import { CommonTemplateVariables } from './common-template';
import { PlanDBScheme, WorkspaceDBScheme } from 'hawk.types';

export interface PaymentSuccessTemplateVariables extends CommonTemplateVariables {
  /**
   * Workspace whose plan was paid for
   */
  workspace: WorkspaceDBScheme;

  /**
   * Workspace plan
   */
  plan: PlanDBScheme;
}

/**
 * Object with type and variables for template for success payment notification
 */
export interface PaymentSuccessNotification extends Notification<PaymentSuccessTemplateVariables> {
  /**
   * Notification when the balance is credited successfully
   */
  type: 'payment-success';

  /**
   * Notification payload
   */
  payload: PaymentSuccessTemplateVariables;
}
