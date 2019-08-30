export enum EventType {
  DailyCheck = 'daily-check',
  PlanChanged = 'plan-changed'
}

export interface PaymasterEvent {
  type: EventType;
  payload: PaymasterEventPayload;
}

export interface DailyCheckEvent extends PaymasterEvent {
  type: EventType.DailyCheck;
  payload: DailyCheckEventPayload;
}

export interface PlanChangedEvent extends PaymasterEvent {
  type: EventType.PlanChanged;
  payload: PlanChangedEventPayload;
}

export type DailyCheckEventPayload = undefined;

export interface PlanChangedEventPayload {
  workspaceId: string;
  oldPlan: string;
  newPlan: string;
}

export type PaymasterEventPayload = DailyCheckEventPayload | PlanChangedEventPayload;
