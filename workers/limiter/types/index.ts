import { PlanDBScheme, WorkspaceDBScheme } from '@hawk.so/types';

/**
 * Workspace with its tariff plan
 */
export type WorkspaceWithTariffPlan = Pick<
  WorkspaceDBScheme,
  '_id' | 'name' | 'isBlocked' | 'blockedDate' | 'lastChargeDate' | 'billingPeriodEventsCount'
> & {
  tariffPlan: PlanDBScheme;
};
