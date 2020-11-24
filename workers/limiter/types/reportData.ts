import { WorkspaceDBScheme } from 'hawk.types';

/**
 * Data for sending notification after task handling
 */
interface ReportData {
  /**
   * Banned workspaces data
   */
  bannedWorkspaces: WorkspaceDBScheme[];

  /**
   * Data about workspaces with missing lastChargeDate field
   */
  workspacesWithoutLastChargeDate: Set<WorkspaceDBScheme>;

  /**
   * Projects ids to ban
   */
  bannedProjectIds: string[];
}

export default ReportData;