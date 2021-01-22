export interface SenderWorkerLowBalancePayload {
  /**
   * ID of the workspace
   */
  workspaceId: string;

  /**
   * Notification endpoint
   */
  endpoint: string;
}

/**
 * Payload of an event when workspace balance is low
 */
export interface SenderWorkerLowBalanceTask {
  type: 'low-balance',
  payload: SenderWorkerLowBalancePayload
}