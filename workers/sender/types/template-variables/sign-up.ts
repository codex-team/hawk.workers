import { CommonTemplateVariables } from './common-template';
import { Notification } from './notification';

/**
 * Variables for sign up template
 */
export interface SignUpVariables extends CommonTemplateVariables {
  /**
   * Password generated for the user
   */
  password: string;

  /**
   * Email of the user
   */
  email: string;
}

/**
 * An object with the notification type and variables
 * for sending a registration message with a password to the user
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