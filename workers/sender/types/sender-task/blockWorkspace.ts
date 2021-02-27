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
  type: 'block-workspace',
  payload: SenderWorkerBlockWorkspacePayload
}
