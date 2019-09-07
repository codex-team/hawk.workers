/**
 * Types definitions for paymaster worker
 */

/**
 * Paymaster events types
 */
export enum EventType {
  /**
   * Daily check event
   */
  DailyCheck = 'daily-check',
  /**
   * Plan changed event
   */
  PlanChanged = 'plan-changed'
}

/**
 * Tariff plan interface
 */
export interface TariffPlan {
  /**
   * Plan name
   */
  name: string;

  /**
   * Monthly charge for current plan
   */
  monthlyCharge: number;

  /**
   * Event limits for current plan
   */
  eventsLimit: number;
}

/**
 * Plan object of workspace
 */
export interface WorkspacePlan {
  /**
   * Plan name
   */
  name: string;

  /**
   * Last charge date timestamp
   */
  lastChargeDate: number;

  /**
   * Subscription date timestamp
   */
  subscriptionDate: number;
}

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
export interface DailyCheckEvent extends PaymasterEvent {
  type: EventType.DailyCheck;
  payload: DailyCheckEventPayload;
}

/**
 * Plan changed event interface
 */
export interface PlanChangedEvent extends PaymasterEvent {
  type: EventType.PlanChanged;
  payload: PlanChangedEventPayload;
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
