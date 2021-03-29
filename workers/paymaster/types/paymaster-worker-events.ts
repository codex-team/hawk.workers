/**
 * Types definitions for paymaster worker
 */

/**
 * Paymaster events types
 */
export enum EventType {
  /**
   * Workspace subscription check event to ban workspaces without actual subscription
   */
  WorkspaceSubscriptionCheck = 'workspace-subscription-check',
}

/**
 * Paymaster worker task interface
 */
export interface PaymasterEvent {
  /**
   * Event type
   */
  type: EventType;
}
