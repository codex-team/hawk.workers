/**
 * Payload for task for blocked workspace reminder
 */
export interface SenderWorkerBlockedWorkspaceReminderPayload {
  /**
   * Blocked workspace id
   */
  workspaceId: string;

  /**
   * Days while workspace is blocked
   */
  daysAfterBlock: number;
}

/**
 * Payload of an event for blocked workspace reminder
 */
export interface SenderWorkerBlockedWorkspaceReminderTask {
  /**
   * Task for blocked workspace reminder
   */
  type: 'blocked-workspace-reminder';

  /**
   * Payload for task for blocked workspace reminder
   */
  payload: SenderWorkerBlockedWorkspaceReminderPayload;
}
