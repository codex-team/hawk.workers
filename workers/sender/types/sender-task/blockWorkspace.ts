/**
 * Payload for task when workspace blocked
 */
export interface SenderWorkerBlockWorkspacePayload {
  /**
   * Blocked workspace id
   */
  workspaceId: string;
}

/**
 * Payload of an event when workspace blocked
 */
export interface SenderWorkerBlockWorkspaceTask {
  /**
   * Task when workspace blocked
   */
  type: 'block-workspace',

  /**
   * Payload for task when workspace blocked
   */
  payload: SenderWorkerBlockWorkspacePayload
}
