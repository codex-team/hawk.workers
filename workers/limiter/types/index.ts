import { PlanDBScheme, WorkspaceDBScheme } from '@hawk.so/types';

/**
 * Workspace with its tariff plan
 */
export type WorkspaceWithTariffPlan = WorkspaceDBScheme & {tariffPlan: PlanDBScheme};
