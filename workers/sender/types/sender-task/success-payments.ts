export interface SenderWorkerSuccessPaymentPayload {
  /**
   * ID of the workspace
   */
  workspaceId: string;

  /**
   * Notification endpoint
   */
  endpoint: string;

  /**
   * Workspace balance
   */
  balance: number;
}

/**
 * Payload of an event when workspace balance was successfully replenished
 */
export interface SenderWorkerSuccessPaymentTask {
  type: 'success-payment',
  payload: SenderWorkerSuccessPaymentPayload
}