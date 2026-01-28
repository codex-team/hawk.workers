import { Collection, Db, MongoClient, ObjectId } from 'mongodb';
import '../../../env-test';
import { GroupedEventDBScheme, PlanDBScheme, ProjectDBScheme, WorkspaceDBScheme } from '@hawk.so/types';
import { DbHelper } from '../src/dbHelper';
import { mockedPlans } from './plans.mock';
import { MS_IN_SEC } from '../../../lib/utils/consts';

/**
 * Constant of last charge date in all workspaces for tests
 */
const LAST_CHARGE_DATE = new Date(1585742400 * 1000);

describe('DbHelper', () => {
  let connection: MongoClient;
  let db: Db;
  let projectCollection: Collection<ProjectDBScheme>;
  let workspaceCollection: Collection<WorkspaceDBScheme>;
  let planCollection: Collection<PlanDBScheme>;
  let dbHelper: DbHelper;

  /**
   * Returns mocked workspace
   *
   * @param parameters - parameters to create workspace mock
   */
  const createWorkspaceMock = (parameters: {
    plan: PlanDBScheme;
    billingPeriodEventsCount: number;
    lastChargeDate: Date;
    isBlocked?: boolean;
    blockedDate?: Date;
  }): WorkspaceDBScheme => {
    return {
      _id: new ObjectId(),
      name: 'Mocked workspace',
      inviteHash: '',
      tariffPlanId: parameters.plan._id,
      billingPeriodEventsCount: parameters.billingPeriodEventsCount,
      lastChargeDate: parameters.lastChargeDate,
      accountId: '',
      balance: 0,
      isBlocked: parameters.isBlocked,
      blockedDate: parameters.blockedDate,
    };
  };

  /**
   * Returns mocked project
   *
   * @param parameters - parameters to create project mock
   */
  const createProjectMock = (parameters: { workspaceId: ObjectId }): ProjectDBScheme => {
    return {
      _id: new ObjectId(),
      name: 'Mocked project',
      integrationId: 'eyJpbnRlZ3JhdGlvbklkIjoiMzg3NGNkOWMtZjJiYS00ZDVkLTk5ZmQtM2UzZjYzMDcxYmJhIiwic2VjcmV0IjoiMGZhM2JkM2EtYmMyZC00YWRiLThlMWMtNjg2OGY0MzM1YjRiIn0=',
      workspaceId: parameters.workspaceId,
      notifications: [],
      token: '',
      uidAdded: undefined,
      eventGroupingPatterns: [],
    };
  };

  /**
   * Returns mocked event for tests
   */
  const createEventMock = (): GroupedEventDBScheme => {
    return {
      catcherType: '',
      totalCount: 0,
      usersAffected: 0,
      visitedBy: [],
      groupHash: 'ade987831d0d0d167aeea685b49db164eb4e113fd027858eef7f69d049357f62',
      payload: {
        title: 'Mocked event',
      },
      timestamp: 1586892935,
    };
  };

  /**
   * Fills database with workspace, project and events for this project
   *
   * @param parameters - workspace, project and mocked events amount to be inserted
   */
  const fillDatabaseWithMockedData = async (parameters: {
    workspace?: WorkspaceDBScheme,
    project: ProjectDBScheme,
    eventsToMock: number
    repetitionsToMock?: number,
  }): Promise<void> => {
    const eventsCollection = db.collection(`events:${parameters.project._id.toString()}`);
    const repetitionsCollection = db.collection(`repetitions:${parameters.project._id.toString()}`);

    if (parameters.workspace) {
      await workspaceCollection.insertOne(parameters.workspace);
    }
    await projectCollection.insertOne(parameters.project);
    const mockedEvents: GroupedEventDBScheme[] = [];

    for (let i = 0; i < parameters.eventsToMock; i++) {
      mockedEvents.push(createEventMock());
    }
    await eventsCollection.insertMany(mockedEvents);

    mockedEvents.length = 0;

    if (parameters.repetitionsToMock > 0) {
      for (let i = 0; i < parameters.repetitionsToMock; i++) {
        mockedEvents.push(createEventMock());
      }
      await repetitionsCollection.insertMany(mockedEvents);
    }
  };

  beforeAll(async () => {
    connection = await MongoClient.connect(process.env.MONGO_ACCOUNTS_DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    db = await connection.db('hawk');
    projectCollection = db.collection<ProjectDBScheme>('projects');
    workspaceCollection = db.collection<WorkspaceDBScheme>('workspaces');
    planCollection = db.collection('plans');

    /**
     * Insert mocked plans for using in tests
     */
    await planCollection.deleteMany({});
    await planCollection.insertMany(Object.values(mockedPlans));

    dbHelper = new DbHelper(projectCollection, workspaceCollection, db);
  }, 30000); // 30 seconds timeout for MongoDB connection and setup

  beforeEach(async () => {
    await projectCollection.deleteMany({});
    await workspaceCollection.deleteMany({});
  });

  describe('getWorkspacesWithTariffPlans', () => {
    test('Should return all workspaces with their tariff plans', async () => {
      /**
       * Arrange
       */
      const workspace1 = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10,
        billingPeriodEventsCount: 0,
        lastChargeDate: new Date(),
      });
      const workspace2 = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10000,
        billingPeriodEventsCount: 0,
        lastChargeDate: new Date(),
      });

      await workspaceCollection.insertMany([workspace1, workspace2]);

      /**
       * Act
       */
      const result = await dbHelper.getWorkspacesWithTariffPlans();

      /**
       * Assert
       */
      expect(result).toHaveLength(2);
      expect(result[0].tariffPlan).toBeDefined();
      expect(result[1].tariffPlan).toBeDefined();
      expect(result[0].tariffPlan.eventsLimit).toBe(10);
      expect(result[1].tariffPlan.eventsLimit).toBe(10000);
    });

    test('Should return single workspace with its tariff plan by id', async () => {
      /**
       * Arrange
       */
      const workspace = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10,
        billingPeriodEventsCount: 0,
        lastChargeDate: new Date(),
      });

      await workspaceCollection.insertOne(workspace);

      /**
       * Act
       */
      const result = await dbHelper.getWorkspacesWithTariffPlans(workspace._id.toString());

      /**
       * Assert
       */
      expect(result).toBeDefined();
      expect(result.tariffPlan).toBeDefined();
      expect(result.tariffPlan.eventsLimit).toBe(10);
    });
  });

  describe('updateWorkspacesEventsCountAndIsBlocked', () => {
    test('Should update multiple workspaces', async () => {
      /**
       * Arrange
       */
      const workspace1 = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10,
        billingPeriodEventsCount: 0,
        lastChargeDate: new Date(),
      });
      const workspace2 = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10000,
        billingPeriodEventsCount: 0,
        lastChargeDate: new Date(),
      });

      await workspaceCollection.insertMany([workspace1, workspace2]);

      const blockedDate = new Date();
      const updatedWorkspaces = [
        {
          ...workspace1,
          billingPeriodEventsCount: 5,
          isBlocked: true,
          blockedDate: blockedDate,
          tariffPlan: mockedPlans.eventsLimit10,
        },
        {
          ...workspace2,
          billingPeriodEventsCount: 5000,
          isBlocked: true,
          blockedDate: blockedDate,
          tariffPlan: mockedPlans.eventsLimit10000,
        },
      ];

      /**
       * Act
       */
      await dbHelper.updateWorkspacesEventsCountAndIsBlocked(updatedWorkspaces);

      /**
       * Assert
       */
      const updatedWorkspace1 = await workspaceCollection.findOne({ _id: workspace1._id });
      const updatedWorkspace2 = await workspaceCollection.findOne({ _id: workspace2._id });

      expect(updatedWorkspace1.billingPeriodEventsCount).toBe(5);
      expect(updatedWorkspace1.isBlocked).toBe(true);
      expect(updatedWorkspace1.blockedDate).toEqual(blockedDate);
      expect(updatedWorkspace2.billingPeriodEventsCount).toBe(5000);
      expect(updatedWorkspace2.isBlocked).toBe(true);
      expect(updatedWorkspace2.blockedDate).toEqual(blockedDate);
    });

    test('Should not update anything if empty array provided', async () => {
      /**
       * Arrange
       */
      const workspace = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10,
        billingPeriodEventsCount: 0,
        lastChargeDate: new Date(),
        isBlocked: false,
        blockedDate: null,
      });

      await workspaceCollection.insertOne(workspace);

      /**
       * Act
       */
      await dbHelper.updateWorkspacesEventsCountAndIsBlocked([]);

      /**
       * Assert
       */
      const unchangedWorkspace = await workspaceCollection.findOne({ _id: workspace._id });

      expect(unchangedWorkspace).toEqual(workspace);
    });

    test('Should set blockedDate to null when unblocking workspace', async () => {
      /**
       * Arrange
       */
      const blockedDate = new Date();
      const workspace = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10,
        billingPeriodEventsCount: 0,
        lastChargeDate: new Date(),
        isBlocked: true,
        blockedDate: blockedDate,
      });

      await workspaceCollection.insertOne(workspace);

      const updatedWorkspace = {
        ...workspace,
        isBlocked: false,
        blockedDate: null,
        tariffPlan: mockedPlans.eventsLimit10,
      };

      /**
       * Act
       */
      await dbHelper.updateWorkspacesEventsCountAndIsBlocked([ updatedWorkspace ]);

      /**
       * Assert
       */
      const result = await workspaceCollection.findOne({ _id: workspace._id });

      expect(result.isBlocked).toBe(false);
      expect(result.blockedDate).toBeNull();
    });
  });

  describe('getEventsCountByProject', () => {
    test('Should count events and repetitions for a project', async () => {
      /**
       * Arrange
       */
      const workspace = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10,
        billingPeriodEventsCount: 0,
        lastChargeDate: new Date(),
      });
      const project = createProjectMock({ workspaceId: workspace._id });

      await fillDatabaseWithMockedData({
        workspace,
        project,
        eventsToMock: 5,
        repetitionsToMock: 5,
      });

      const since = Math.floor(LAST_CHARGE_DATE.getTime() / MS_IN_SEC);

      /**
       * Act
       */
      const count = await dbHelper.getEventsCountByProject(project, since);

      /**
       * Assert
       */
      expect(count).toBe(10); // 5 events + 5 repetitions
    });
  });

  describe('getEventsCountByProjects', () => {
    test('Should count events and repetitions for multiple projects', async () => {
      /**
       * Arrange
       */
      const workspace = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10,
        billingPeriodEventsCount: 0,
        lastChargeDate: new Date(),
      });
      const project1 = createProjectMock({ workspaceId: workspace._id });
      const project2 = createProjectMock({ workspaceId: workspace._id });

      await fillDatabaseWithMockedData({
        workspace,
        project: project1,
        eventsToMock: 5,
        repetitionsToMock: 5,
      });
      await fillDatabaseWithMockedData({
        project: project2,
        eventsToMock: 3,
        repetitionsToMock: 3,
      });

      const since = Math.floor(LAST_CHARGE_DATE.getTime() / MS_IN_SEC);

      /**
       * Act
       */
      const count = await dbHelper.getEventsCountByProjects([project1, project2], since);

      /**
       * Assert
       */
      expect(count).toBe(16); // (5 + 5) + (3 + 3) events and repetitions
    });
  });

  describe('getProjects', () => {
    test('Should return all projects when no workspaceId provided', async () => {
      /**
       * Arrange
       */
      const workspace1 = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10,
        billingPeriodEventsCount: 0,
        lastChargeDate: new Date(),
      });
      const workspace2 = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10000,
        billingPeriodEventsCount: 0,
        lastChargeDate: new Date(),
      });

      const project1 = createProjectMock({ workspaceId: workspace1._id });
      const project2 = createProjectMock({ workspaceId: workspace2._id });

      await workspaceCollection.insertMany([workspace1, workspace2]);
      await projectCollection.insertMany([project1, project2]);

      /**
       * Act
       */
      const projects = await dbHelper.getProjects();

      /**
       * Assert
       */
      expect(projects).toHaveLength(2);
      expect(projects.map(p => p._id.toString())).toContain(project1._id.toString());
      expect(projects.map(p => p._id.toString())).toContain(project2._id.toString());
    });

    test('Should return only projects for specified workspace', async () => {
      /**
       * Arrange
       */
      const workspace1 = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10,
        billingPeriodEventsCount: 0,
        lastChargeDate: new Date(),
      });
      const workspace2 = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10000,
        billingPeriodEventsCount: 0,
        lastChargeDate: new Date(),
      });

      const project1 = createProjectMock({ workspaceId: workspace1._id });
      const project2 = createProjectMock({ workspaceId: workspace2._id });

      await workspaceCollection.insertMany([workspace1, workspace2]);
      await projectCollection.insertMany([project1, project2]);

      /**
       * Act
       */
      const projects = await dbHelper.getProjects(workspace1._id.toString());

      /**
       * Assert
       */
      expect(projects).toHaveLength(1);
      expect(projects[0]._id.toString()).toBe(project1._id.toString());
    });
  });

  afterAll(async () => {
    await connection.close();
  });
});
