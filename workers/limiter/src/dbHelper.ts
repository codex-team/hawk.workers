import { Collection, Db, ObjectId } from 'mongodb';
import { PlanDBScheme, ProjectDBScheme, WorkspaceDBScheme } from '@hawk.so/types';
import { WorkspaceWithTariffPlan } from '../types';
import HawkCatcher from '@hawk.so/nodejs';
import { CriticalError, NonCriticalError } from '../../../lib/workerErrors';

const WORKSPACE_PROJECTION = {
  _id: 1,
  name: 1,
  isBlocked: 1,
  blockedDate: 1,
  lastChargeDate: 1,
  billingPeriodEventsCount: 1,
  tariffPlanId: 1,
} as const;

type WorkspaceForLimiter = Pick<
  WorkspaceDBScheme,
  '_id' | 'name' | 'isBlocked' | 'blockedDate' | 'lastChargeDate' | 'billingPeriodEventsCount' | 'tariffPlanId'
>;

/**
 * Class that implements methods used for interaction between limiter and db
 */
export class DbHelper {
  /**
   * Connection to events DB
   */
  private eventsDbConnection: Db;

  /**
   * Collection with projects
   */
  private projectsCollection: Collection<ProjectDBScheme>;

  /**
   * Collection with workspaces
   */
  private workspacesCollection: Collection<WorkspaceDBScheme>;

  /**
   * Collection with tariff plans
   */
  private plansCollection: Collection<PlanDBScheme>;

  /**
   * In-memory cache of tariff plans — avoids $lookup on the small plans collection per workspace
   */
  private plans: PlanDBScheme[] = [];

  /**
   * Plan ids that were still missing after a cache refresh — don't trigger more refreshes for them
   */
  private knownMissingPlanIds: Set<string> = new Set();

  /**
   * @param projects - projects collection
   * @param workspaces - workspaces collection
   * @param plans - plans collection
   * @param eventsDbConnection - connection to events DB
   */
  constructor(
    projects: Collection<ProjectDBScheme>,
    workspaces: Collection<WorkspaceDBScheme>,
    plans: Collection<PlanDBScheme>,
    eventsDbConnection: Db
  ) {
    this.eventsDbConnection = eventsDbConnection;
    this.projectsCollection = projects;
    this.workspacesCollection = workspaces;
    this.plansCollection = plans;
  }

  /**
   * Fetches tariff plans from database and keeps them cached
   */
  public async fetchPlans(): Promise<void> {
    this.plans = await this.plansCollection.find({}).toArray();
    this.knownMissingPlanIds.clear();

    if (this.plans.length === 0) {
      throw new CriticalError('Please add tariff plans to the database');
    }
  }

  /**
   * Method that yields all workspaces with their tariff plans
   */
  public getWorkspacesWithTariffPlans(): AsyncGenerator<WorkspaceWithTariffPlan>;
  /**
   * Method that returns workspace with its tariff plan by its id
   *
   * @param id - id of the workspace to fetch
   */
  public getWorkspacesWithTariffPlans(id: string): Promise<WorkspaceWithTariffPlan>;
  /**
   * @param id - id of the workspace to fetch
   */
  public getWorkspacesWithTariffPlans(id?: string): AsyncGenerator<WorkspaceWithTariffPlan> | Promise<WorkspaceWithTariffPlan> {
    if (id !== undefined) {
      return this.getOneWorkspaceWithTariffPlan(id);
    }

    return this.yieldWorkspacesWithTariffPlans();
  }

  /**
   * Updates workspaces data in Database
   *
   * @param workspacesToUpdate - array of workspaces to be updated
   */
  public async updateWorkspacesEventsCountAndIsBlocked(workspacesToUpdate: WorkspaceWithTariffPlan[]): Promise<void> {
    if (workspacesToUpdate.length === 0) {
      return;
    }

    const operations = workspacesToUpdate.map(workspace => {
      return {
        updateOne: {
          filter: {
            _id: workspace._id,
          },
          update: {
            $set: {
              billingPeriodEventsCount: workspace.billingPeriodEventsCount,
              isBlocked: workspace.isBlocked,
              blockedDate: workspace.blockedDate,
            },
          },
        },
      };
    });

    await this.workspacesCollection.bulkWrite(operations);
  }

  /**
   * Returns total event counts for last billing period
   *
   * @param project - project to check
   * @param since - timestamp of the time from which we count the events
   */
  public async getEventsCountByProject(
    project: ProjectDBScheme,
    since: number
  ): Promise<number> {
    try {
      const repetitionsCollection = this.eventsDbConnection.collection('repetitions:' + project._id.toString());
      const eventsCollection = this.eventsDbConnection.collection('events:' + project._id.toString());

      const query = {
        timestamp: {
          $gt: since,
        },
      };

      const repetitionsCount = await repetitionsCollection.countDocuments(query);
      const originalEventCount = await eventsCollection.countDocuments(query);

      return repetitionsCount + originalEventCount;
    } catch (e) {
      HawkCatcher.send(e);
      throw new CriticalError(e);
    }
  }

  /**
   * Calculates total events count for all provided projects since the specific date
   *
   * @param projects - projects to calculate for
   * @param since - timestamp of the time from which we count the events
   */
  public async getEventsCountByProjects(projects: ProjectDBScheme[], since: number): Promise<number> {
    const sum = (array: number[]): number => array.reduce((acc, val) => acc + val, 0);

    return Promise.all(projects.map(
      project => this.getEventsCountByProject(project, since)
    ))
      .then(sum);
  }

  /**
   * Returns all projects from Database or projects of the specified workspace
   *
   * @param [workspaceId] - workspace ids to fetch projects that belongs that workspace
   */
  public getProjects(workspaceId?: string): Promise<ProjectDBScheme[]> {
    const query = workspaceId
      ? {
        $or: [
          { workspaceId: workspaceId },
          { workspaceId: new ObjectId(workspaceId) },
        ],
      }
      : {};

    return this.projectsCollection.find(query).toArray();
  }

  /**
   * Returns plan from cache, refetches once on miss
   *
   * @param planId - id of the plan to find
   */
  private async resolvePlan(planId: WorkspaceDBScheme['tariffPlanId']): Promise<PlanDBScheme | null> {
    let plan = this.findPlanById(planId);

    if (plan) {
      return plan;
    }

    const planIdStr = planId.toString();

    if (this.knownMissingPlanIds.has(planIdStr)) {
      return null;
    }

    await this.fetchPlans();
    plan = this.findPlanById(planId);

    if (!plan) {
      this.knownMissingPlanIds.add(planIdStr);
    }

    return plan ?? null;
  }

  /**
   * @param planId - id of the plan to find
   */
  private findPlanById(planId: WorkspaceDBScheme['tariffPlanId']): PlanDBScheme | undefined {
    return this.plans.find((plan) => plan._id.toString() === planId.toString());
  }

  /**
   * Returns a single workspace with its tariff plan by id
   *
   * @param id - workspace id
   */
  private async getOneWorkspaceWithTariffPlan(id: string): Promise<WorkspaceWithTariffPlan> {
    const workspace = await this.workspacesCollection
      .find({ _id: new ObjectId(id) })
      .project<WorkspaceForLimiter>(WORKSPACE_PROJECTION)
      .next();

    if (workspace === null) {
      throw new NonCriticalError(`Workspace ${id} not found`, {
        workspaceId: id,
      });
    }

    const plan = await this.resolvePlan(workspace.tariffPlanId);

    if (!plan) {
      throw new NonCriticalError(`Tariff plan ${workspace.tariffPlanId.toString()} not found for workspace ${id}`, {
        workspaceId: id,
      });
    }

    return {
      ...workspace,
      tariffPlan: plan,
    };
  }

  /**
   * Yields all workspaces with their tariff plans one by one
   */
  private async * yieldWorkspacesWithTariffPlans(): AsyncGenerator<WorkspaceWithTariffPlan> {
    const cursor = this.workspacesCollection
      .find({})
      .project<WorkspaceForLimiter>(WORKSPACE_PROJECTION);

    for await (const workspace of cursor) {
      const plan = await this.resolvePlan(workspace.tariffPlanId);

      if (!plan) {
        HawkCatcher.send(
          new Error(`[Limiter] Tariff plan not found for workspace`),
          {
            workspaceId: workspace._id.toString(),
            tariffPlanId: workspace.tariffPlanId?.toString(),
          }
        );
        continue;
      }

      yield {
        ...workspace,
        tariffPlan: plan,
      };
    }
  }
}
