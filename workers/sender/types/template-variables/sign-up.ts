import { CommonTemplateVariables } from './common-template';
import { Notification } from './notification';

/**
 * Variables for events template
 */
export interface SignUpVariables extends CommonTemplateVariables {
  /**
   * Password generated for the user
   */
  password: string
}

/**
 * Object with notification type and variables for the assignee event template
 */
export interface SignUpNotification extends Notification<SignUpVariables> {
  /**
   * Notification when the user has registered
   */
  type: 'sign-up';

  /**
   * Notification payload
   */
  payload: SignUpVariables;
}