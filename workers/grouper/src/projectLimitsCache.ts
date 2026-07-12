import type { Db } from 'mongodb';
import { DatabaseController } from '../../../lib/db/controller';
import createLogger from '../../../lib/logger';

/**
 * Rate limit settings stored in MongoDB (plans, workspaces, projects).
 */
interface RateLimitSettingsDocument {
  N?: number;
  T?: number;
}

interface ProjectDocument {
  _id: { toString(): string };
  workspaceId?: { toString(): string };
  rateLimitSettings?: RateLimitSettingsDocument;
}

interface PlanDocument {
  _id: unknown;
  rateLimitSettings?: RateLimitSettingsDocument;
}

interface WorkspaceDocument {
  _id: { toString(): string };
  rateLimitSettings?: RateLimitSettingsDocument;
  plan: PlanDocument;
}

/**
 * Resolved rate limit for a project.
 */
export interface ProjectRateLimits {
  eventsLimit: number;
  eventsPeriod: number;
}

const CONTEXT_TIMEOUT_MS = 5000;

/**
 * In-memory cache of project rate limits loaded from MongoDB accounts database.
 * Priority: project → workspace → plan.
 */
export default class ProjectLimitsCache {
  private projectLimits = new Map<string, ProjectRateLimits>();

  private readonly logger = createLogger();

  /**
   * @param accountsDb - accounts database controller
   */
  constructor(private readonly accountsDb: DatabaseController) {}

  /**
   * Returns cached rate limits for a project.
   *
   * @param projectId - project id
   */
  public getProjectLimits(projectId: string): ProjectRateLimits | undefined {
    return this.projectLimits.get(projectId);
  }

  /**
   * Reload all project limits from MongoDB.
   */
  public async refresh(): Promise<void> {
    const db = await this.accountsDb.connect();
    const projectLimitsTmp = new Map<string, ProjectRateLimits>();

    const workspaceMap = await this.loadWorkspacesWithPlans(db);

    const projects = await db.collection<ProjectDocument>('projects')
      .find({}, { maxTimeMS: CONTEXT_TIMEOUT_MS })
      .toArray();

    for (const project of projects) {
      const projectId = project._id.toString();
      let finalLimits: ProjectRateLimits = {
        eventsLimit: 0,
        eventsPeriod: 0,
      };

      const workspaceId = project.workspaceId?.toString();
      const workspace = workspaceId ? workspaceMap.get(workspaceId) : undefined;

      if (workspace) {
        finalLimits = {
          eventsLimit: toNumber(workspace.plan?.rateLimitSettings?.N),
          eventsPeriod: toNumber(workspace.plan?.rateLimitSettings?.T),
        };

        const workspaceLimit = toNumber(workspace.rateLimitSettings?.N);
        const workspacePeriod = toNumber(workspace.rateLimitSettings?.T);

        if (workspaceLimit > 0) {
          finalLimits.eventsLimit = workspaceLimit;
        }
        if (workspacePeriod > 0) {
          finalLimits.eventsPeriod = workspacePeriod;
        }
      }

      const projectLimit = toNumber(project.rateLimitSettings?.N);
      const projectPeriod = toNumber(project.rateLimitSettings?.T);

      if (projectLimit > 0) {
        finalLimits.eventsLimit = projectLimit;
      }
      if (projectPeriod > 0) {
        finalLimits.eventsPeriod = projectPeriod;
      }

      projectLimitsTmp.set(projectId, finalLimits);
    }

    this.projectLimits = projectLimitsTmp;
    this.logger.debug(`Project limits cache refreshed with ${projectLimitsTmp.size} projects`);
  }

  /**
   * Load workspaces joined with tariff plans.
   *
   * @param db - accounts database
   */
  private async loadWorkspacesWithPlans(db: Db): Promise<Map<string, WorkspaceDocument>> {
    const workspaces = await db.collection<WorkspaceDocument>('workspaces')
      .aggregate<WorkspaceDocument>([
        {
          $lookup: {
            from: 'plans',
            localField: 'tariffPlanId',
            foreignField: '_id',
            as: 'plan',
          },
        },
        { $unwind: '$plan' },
      ], { maxTimeMS: CONTEXT_TIMEOUT_MS })
      .toArray();

    const workspaceMap = new Map<string, WorkspaceDocument>();

    for (const workspace of workspaces) {
      workspaceMap.set(workspace._id.toString(), workspace);
    }

    return workspaceMap;
  }
}

/**
 * Coerce MongoDB numeric values to number.
 *
 * @param value - raw value from document
 */
function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'object' && value !== null && 'toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }

  if (typeof value === 'string') {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}
