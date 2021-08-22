import { CommonTemplateVariables } from './common-template';
import { Notification } from './notification';

/**
 * Variables for the password-reset template
 */
export interface PasswordResetVariables extends CommonTemplateVariables {
  /**
   * Password generated for the user
   */
  password: string
}

/**
 * Notification for the password-reset template
 */
export interface PasswordResetNotification extends Notification<PasswordResetVariables> {
  /**
   * Notification when the user resets his password
   */
  type: 'password-reset';

  /**
   * Notification payload
   */
  payload: PasswordResetVariables;
}