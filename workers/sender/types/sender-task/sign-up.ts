export interface SenderWorkerSignUpPayload {
  /**
   * Generated password during registration
   */
  password: string;

  /**
   * Notification endpoint
   */
  endpoint: string;
}

/**
 * Payload of an event for sending a message the registration
 */
export interface SenderWorkerSignUpTask {
  type: 'sign-up',
  payload: SenderWorkerSignUpPayload
}