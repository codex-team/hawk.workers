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

/**
 * All types of events for limiter worker
 */
type LimiterEvent = CheckSingleWorkspaceEvent | RegularWorkspacesCheckEvent;

export default LimiterEvent;
