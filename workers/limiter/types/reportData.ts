import { WorkspaceWithTariffPlan } from './index';

/**
 * Data for sending notification after task handling
 */
export interface SingleWorkspaceAnalyzeReport {
  /**
   * Is workspace get blocked
   */
  shouldBeBlockedByQuota: boolean;

  /**
   * Workspace with updated data (current events count)
   */
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

  /**
   * Array of workspaces with updated fields
   */
  updatedWorkspaces: WorkspaceWithTariffPlan[]
}
