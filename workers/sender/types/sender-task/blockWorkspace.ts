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
 * Payload of an event assigning someone to resolve the issue (event)
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
