export interface SenderWorkerWorkspaceInvitePayload {
  /**
   * Name of the workspace to which the user was invited
   */
  workspaceName: string;

  /**
   * Link to join into workspace
   */
  inviteLink: string;

  /**
   * Notification endpoint
   */
  endpoint: string;
}

/**
 * Payload of an event to invite the user to the workspace
 */
export interface SenderWorkerWorkspaceInviteTask {
  type: 'workspace-invite',
  payload: SenderWorkerWorkspaceInvitePayload
}
