export interface SenderWorkerPaymentFailedPayload {
  /**
   * Workplace ID for which the payment should have been received
   */
  workspaceId: string;

  /**
   * Rejection reason
   */
  reason: string;

  /**
   * Notification endpoint
   */
  endpoint: string;
}

/**
 * Payload of event when user payment failed
 */
export interface SenderWorkerPaymentFailedTask {
  type: 'payment-failed';
  payload: SenderWorkerPaymentFailedPayload;
}