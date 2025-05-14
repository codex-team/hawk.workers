/**
 * Event for checking events count for specified workspace
 * Limiter will unban workspace projects if event limit doesn't exceed
 */
export interface CheckSingleWorkspaceEvent {
  /**
   * Event type name
   */
  type: 'check-single-workspace'

  /**
   * Workspace id to check
   */
  workspaceId: string;
}

/**
 * Event for checking current total events count in workspaces and limits events receiving if workspace exceed the limit
 */
export interface RegularWorkspacesCheckEvent {
  /**
   * Event type name
   */
  type: 'regular-workspaces-check'
}

export interface BlockWorkspaceEvent {
  /**
   * Event type name
   */
  type: 'block-workspace'

  /**
   * Workspace id to block
   */
  workspaceId: string;
}

export interface UnblockWorkspaceEvent {
  /**
   * Event type name
   */
  type: 'unblock-workspace'

  /**
   * Workspace id to unblock
   */
  workspaceId: string;
}

/**
 * All types of events for limiter worker
 */
type LimiterEvent = CheckSingleWorkspaceEvent | RegularWorkspacesCheckEvent | BlockWorkspaceEvent | UnblockWorkspaceEvent;

export default LimiterEvent;
