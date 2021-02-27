import { WorkspaceDBScheme } from 'hawk.types';
import { CommonTemplateVariables } from './common-template';
import { Notification } from './notification';

/**
 * Variables for events template
 */
export interface PaymentFailedTemplateVariables extends CommonTemplateVariables {
  /**
   * Workspace data
   */
  workspace: WorkspaceDBScheme;
}

/**
 * Object with notification type and variables for the payment failed event template
 */
export interface PaymentFailedNotification extends Notification<PaymentFailedTemplateVariables> {
  /**
   * Notification when user failed the payment
   */
  type: 'payment-failed';

  /**
   * Notification payload
   */
  payload: PaymentFailedTemplateVariables;
}