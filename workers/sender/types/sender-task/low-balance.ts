export interface SenderWorkerLowBalancePayload {
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
 * Payload of an event when workspace balance is low
 */
export interface SenderWorkerLowBalanceTask {
  type: 'low-balance',
  payload: SenderWorkerLowBalancePayload
}