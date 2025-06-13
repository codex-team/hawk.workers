import { Collection, Db, ObjectId } from 'mongodb';
import { ProjectDBScheme, WorkspaceDBScheme } from '@hawk.so/types';
import { WorkspaceWithTariffPlan } from '../types';
import HawkCatcher from '@hawk.so/nodejs';
import { CriticalError } from '../../../lib/workerErrors';

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
   * Method that returns all workspaces with their tariff plans
   */
  public async getWorkspacesWithTariffPlans():Promise<WorkspaceWithTariffPlan[]>;
  /**
   * Method that returns workspace with its tariff plan by its id
   *
   * @param id - id of the workspace to fetch
   */
  public async getWorkspacesWithTariffPlans(id: string):Promise<WorkspaceWithTariffPlan>;
  /**
   * Returns workspace with its tariff plan by its id
   *
   * @param id - workspace id
   */
  public async getWorkspacesWithTariffPlans(id?: string):Promise<WorkspaceWithTariffPlan[] | WorkspaceWithTariffPlan> {
    /* eslint-disable-next-line */
    const queue: any[] = [
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
    ];

    if (id !== undefined) {
      queue.unshift({
        $match: {
          _id: new ObjectId(id),
        },
      });
    }

    const workspacesArray = await this.workspacesCollection.aggregate<WorkspaceWithTariffPlan>(queue).toArray();

    return (id !== undefined) ? workspacesArray[0] : workspacesArray;
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
            },
          },
        },
      };
    });

    await this.workspacesCollection.bulkWrite(operations);
  }

  /**
   * Method to change workspace isBlocked state
   *
   * @param workspaceId - id of the workspace to be changed
   * @param isBlocked - new isBlocked state of the workspace
   */
  public async changeWorkspaceBlockedState(workspaceId: string, isBlocked: boolean): Promise<void> {
    const result = await this.workspacesCollection.updateOne(
      { _id: new ObjectId(workspaceId) },
      {
        $set: {
          isBlocked,
        },
      }
    );

    console.log('result of changeWorkspaceBlockedState', JSON.stringify(result));
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
        $or: [ {
          timestamp: {
            $gt: since,
          },
        },
        {
          'payload.timestamp': {
            $gt: since,
          },
        } ],
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
}