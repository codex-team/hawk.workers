import { ProjectDBScheme } from '@hawk.so/types';
import { WorkspaceWithTariffPlan } from './index';

/**
 * Data for sending notification after task handling
 */
export interface WorkspaceReport {
  /**
   * Is workspace get blocked
   */
  shouldBeBlockedByQuota: boolean;

  /**
   * Workspace with updated data (current events count)
   */
  updatedWorkspace: WorkspaceWithTariffPlan

  /**
   * Projects to update
   */
  projectsToUpdate: ProjectDBScheme[];
}
