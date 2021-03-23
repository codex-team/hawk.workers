export interface SenderWorkerPaymentSuccessPayload {
  /**
   * Id of the user who paid
   */
  userId: string;

  /**
   * Workspace id whose plan was paid for
   */
  workspaceId: string;

  /**
   * The plan that was paid for
   */
  tariffPlanId: string;

  /**
   * Notification endpoint
   */
  endpoint: string;
}

/**
 * Payload of an event when workspace balance was successfully replenished
 */
export interface SenderWorkerPaymentSuccessTask {
  type: 'payment-success',
  payload: SenderWorkerPaymentSuccessPayload
}