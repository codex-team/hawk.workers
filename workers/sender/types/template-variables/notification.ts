/**
 * Notification with payload and type
 */
export interface Notification<Payload> {
  /**
   * Notification type
   */
  type: string;

  /**
   * Notification payload
   */
  payload: Payload;
}