/**
 * Types definitions for paymaster worker
 */

/**
 * Paymaster events types
 */
export enum EventType {
  /**
   * Workspace plan charge event to purchase plan if today is payday
   */
  WorkspacePlanCharge = 'workspace-plan-charge',
  /**
   * Plan changed event
   */
  PlanChanged = 'plan-changed',
}

/**
 * Daily check event payload.
 *
 * This event do not have any payload
 */
export type DailyCheckEventPayload = undefined;

/**
 * Plan changed event payload
 */
export interface PlanChangedEventPayload {
  /**
   * Id of workspace for which plan is changed
   */
  workspaceId: string;

  /**
   * Old plan name
   */
  oldPlan: string;

  /**
   * New plan name
   */
  newPlan: string;
}

/**
 * General paymaster task payload type
 */
export type PaymasterEventPayload = DailyCheckEventPayload | PlanChangedEventPayload;

/**
 * Paymaster worker task interface
 */
export interface PaymasterEvent {
  /**
   * Event type
   */
  type: EventType;

  /**
   * Event payload
   */
  payload: PaymasterEventPayload;
}

/**
 * Daily check event interface
 */
export interface WorkspacePlanChargeEvent extends PaymasterEvent {
  type: EventType.WorkspacePlanCharge;
  payload: DailyCheckEventPayload;
}

/**
 * Plan changed event interface
 */
export interface PlanChangedEvent extends PaymasterEvent {
  type: EventType.PlanChanged;
  payload: PlanChangedEventPayload;
}
