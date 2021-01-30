import { WorkspaceWithTariffPlan } from './index';

/**
 * Data for sending notification after task handling
 */
export interface SingleWorkspaceAnalyzeReport {
  isBanned: boolean;
  updatedWorkspace: WorkspaceWithTariffPlan
}

/**
 * Data for sending notification after task handling
 */
export interface MultiplyWorkspacesAnalyzeReport {
  /**
   * Banned workspaces data
   */
  bannedWorkspaces: WorkspaceWithTariffPlan[];

  /**
   * Projects ids to ban
   */
  bannedProjectIds: string[];

  updatedWorkspaces: WorkspaceWithTariffPlan[]
}
