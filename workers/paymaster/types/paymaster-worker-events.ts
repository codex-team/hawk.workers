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
 * Daily check event payload.
 *
 * This event do not have any payload
 */
export type DailyCheckEventPayload = undefined;

/**
 * Paymaster worker task interface
 */
export interface PaymasterEvent {
  /**
   * Event type
   */
  type: EventType;
}
