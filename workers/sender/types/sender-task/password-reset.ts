export interface SenderWorkerPasswordResetPayload {
  /**
   * New generated password to replace the forgotten one
   */
  newPassword: string;

  /**
   * Notification endpoint
   */
  endpoint: string;
}

/**
 * Payload of an event to restore access
 */
export interface SenderWorkerPasswordResetTask {
  type: 'password-reset',
  payload: SenderWorkerPasswordResetPayload
}