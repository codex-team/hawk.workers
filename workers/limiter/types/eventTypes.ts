/**
 * Event for checking events count for specified workspace
 * Limiter will unban workspace projects if event limit doesn't exceed
 */
export interface CheckWorkspaceEvent {
  type: 'check-workspace'
  workspaceId: string;
}

/**
 * Event for checking current total events count in workspaces and limits events receiving if workspace exceed the limit
 */
export interface RegularWorkspacesCheckEvent {
  type: 'regular-workspaces-check'
}

/**
 * All types of events for limiter worker
 */
type LimiterEvent = CheckWorkspaceEvent | RegularWorkspacesCheckEvent;

export default LimiterEvent;
