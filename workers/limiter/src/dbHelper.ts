import { Collection, Db, ObjectId } from 'mongodb';
import { ProjectDBScheme, WorkspaceDBScheme } from '@hawk.so/types';
import { WorkspaceWithTariffPlan } from '../types';
import HawkCatcher from '@hawk.so/nodejs';
import { CriticalError, NonCriticalError } from '../../../lib/workerErrors';

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
   * @param projects - projects collection
   * @param workspaces - workspaces collection
   * @param eventsDbConnection - connection to events DB
   */
  constructor(projects: Collection<ProjectDBScheme>, workspaces: Collection<WorkspaceDBScheme>, eventsDbConnection: Db) {
    this.eventsDbConnection = eventsDbConnection;
    this.projectsCollection = projects;
    this.workspacesCollection = workspaces;
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
   * Returns a single workspace with its tariff plan by id
   *
   * @param id - workspace id
   */
  private async getOneWorkspaceWithTariffPlan(id: string): Promise<WorkspaceWithTariffPlan> {
    const pipeline = [
      {
        $match: {
          _id: new ObjectId(id),
        },
      },
      ...this.tariffPlanLookupPipeline(),
    ];

    const workspace = await this.workspacesCollection.aggregate<WorkspaceWithTariffPlan>(pipeline).next();

    if (workspace === null) {
      throw new NonCriticalError(`Workspace ${id} not found`, {
        workspaceId: id,
      });
    }

    return workspace;
  }

  /**
   * Yields all workspaces with their tariff plans one by one
   */
  private async * yieldWorkspacesWithTariffPlans(): AsyncGenerator<WorkspaceWithTariffPlan> {
    const pipeline = this.tariffPlanLookupPipeline();
    const cursor = this.workspacesCollection.aggregate<WorkspaceWithTariffPlan>(pipeline);

    for await (const workspace of cursor) {
      yield workspace;
    }
  }

  /* eslint-disable-next-line */
  private tariffPlanLookupPipeline(): any[] {
    return [
      {
        $lookup: {
          from: 'plans',
          localField: 'tariffPlanId',
          foreignField: '_id',
          as: 'tariffPlan',
        },
      },
      {
        $unwind: {
          path: '$tariffPlan',
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          isBlocked: 1,
          blockedDate: 1,
          lastChargeDate: 1,
          billingPeriodEventsCount: 1,
          tariffPlan: 1,
        },
      },
    ];
  }
}