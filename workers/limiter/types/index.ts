import {PlanDBScheme, WorkspaceDBScheme} from "hawk.types";

/**
 * Workspace with its tariff plan
 */
export type WorkspaceWithTariffPlan = WorkspaceDBScheme & {tariffPlan: PlanDBScheme};

