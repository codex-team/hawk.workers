import { Collection, Db, MongoClient, ObjectId } from 'mongodb';
import '../../../env-test';
import { GroupedEventDBScheme, PlanDBScheme, ProjectDBScheme, WorkspaceDBScheme } from '@hawk.so/types';
import LimiterWorker from '../src';
import { createClient } from 'redis';
import { mockedPlans } from './plans.mock';
import { BlockWorkspaceEvent, RegularWorkspacesCheckEvent, UnblockWorkspaceEvent } from '../types/eventTypes';
import * as telegram from '../../../lib/utils/telegram';

/**
 * Mock axios and telegram for testing report sends
 */
jest.mock('axios');
jest.mock('../../../lib/utils/telegram', () => ({
  TelegramBotURLs: {
    Limiter: 'limiter',
  },
  sendMessage: jest.fn(),
}));

const REGULAR_WORKSPACES_CHECK_EVENT: RegularWorkspacesCheckEvent = {
  type: 'regular-workspaces-check',
};

/**
 * Constant of last charge date in all workspaces for tests
 */
const LAST_CHARGE_DATE = new Date(1585742400 * 1000);

describe('Limiter worker', () => {
  let connection: MongoClient;
  let db: Db;
  let projectCollection: Collection<ProjectDBScheme>;
  let workspaceCollection: Collection<WorkspaceDBScheme>;
  let planCollection: Collection<PlanDBScheme>;
  let redisClient;

  /**
   * Returns mocked workspace
   *
   * @param parameters - parameters for creating a workspace
   */
  const createWorkspaceMock = (parameters: {
    plan: PlanDBScheme;
    billingPeriodEventsCount: number;
    lastChargeDate: Date;
    isBlocked?: boolean;
    blockedDate?: Date | null;
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
   * @param parameters - workspaceId - id of the workspace
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
      timestamp: 1586892935,
      payload: {
        title: 'Mocked event',
      },
    };
  };

  /**
   * Fills database with workspace, project and events for this project
   *
   * @param parameters - workspace, project and mocked events amount to be inserted
   */
  const fillDatabaseWithMockedData = async (parameters: {
    workspace: WorkspaceDBScheme,
    project: ProjectDBScheme,
    eventsToMock: number
    repetitionsToMock?: number,
  }): Promise<void> => {
    const eventsCollection = db.collection(`events:${parameters.project._id.toString()}`);
    const repetitionsCollection = db.collection(`repetitions:${parameters.project._id.toString()}`);

    await workspaceCollection.insertOne(parameters.workspace);
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
    redisClient = createClient({ url: process.env.REDIS_URL });
    await redisClient.connect();

    /**
     * Insert mocked plans for using in tests
     */
    await planCollection.deleteMany({});
    await planCollection.insertMany(Object.values(mockedPlans));
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await redisClient.flushAll();
    await projectCollection.deleteMany({});
    await workspaceCollection.deleteMany({});
  });

  describe('regular-workspaces-check', () => {
    test('Should count workspace events for a billing period and save it to the db', async () => {
      /**
       * Arrange
       */
      const workspace = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10,
        billingPeriodEventsCount: 0,
        lastChargeDate: LAST_CHARGE_DATE,
      });
      const project = createProjectMock({ workspaceId: workspace._id });

      await fillDatabaseWithMockedData({
        workspace,
        project,
        eventsToMock: 5,
        repetitionsToMock: 5,
      });

      /**
       * Act
       */
      const worker = new LimiterWorker();

      await worker.start();
      await worker.handle(REGULAR_WORKSPACES_CHECK_EVENT);
      await worker.finish();

      /**
       * Assert
       */
      const workspaceInDatabase = await workspaceCollection.findOne({
        _id: workspace._id,
      });

      expect(workspaceInDatabase.billingPeriodEventsCount).toBe(10); // 5 events + 5 repetitions
    });

    test('Should block projects that have exceeded the plan limit', async () => {
      /**
       * Arrange
       */
      const workspace = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10,
        billingPeriodEventsCount: 0,
        lastChargeDate: LAST_CHARGE_DATE,
      });
      const project = createProjectMock({ workspaceId: workspace._id });

      await fillDatabaseWithMockedData({
        workspace,
        project,
        eventsToMock: 15,
      });

      /**
       * Act
       */
      const worker = new LimiterWorker();

      await worker.start();
      await worker.handle(REGULAR_WORKSPACES_CHECK_EVENT);
      await worker.finish();

      /**
       * Assert
       */
      const result = await redisClient.sMembers('DisabledProjectsSet');
      const updatedWorkspace = await workspaceCollection.findOne({ _id: workspace._id });

      expect(result).toContain(project._id.toString());
      expect(updatedWorkspace.isBlocked).toBe(true);
      expect(updatedWorkspace.blockedDate).toBeInstanceOf(Date);
    });

    test('Should not block project if it does not reach the limit', async () => {
      /**
       * Arrange
       */
      const workspace = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10000,
        billingPeriodEventsCount: 0,
        lastChargeDate: LAST_CHARGE_DATE,
      });
      const project = createProjectMock({ workspaceId: workspace._id });

      await fillDatabaseWithMockedData({
        workspace,
        project,
        eventsToMock: 100,
      });

      /**
       * Act
       */
      const worker = new LimiterWorker();

      await worker.start();
      await worker.handle(REGULAR_WORKSPACES_CHECK_EVENT);
      await worker.finish();

      /**
       * Assert
       */
      const result = await redisClient.sMembers('DisabledProjectsSet');

      expect(result).not.toContain(project._id.toString());
    });

    test('Should send a report with blocked projects', async () => {
      /**
       * Arrange
       */
      const workspace1 = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10,
        billingPeriodEventsCount: 15,
        lastChargeDate: LAST_CHARGE_DATE,
      });
      const workspace2 = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10000,
        billingPeriodEventsCount: 100,
        lastChargeDate: LAST_CHARGE_DATE,
      });
      const project1 = createProjectMock({ workspaceId: workspace1._id });
      const project2 = createProjectMock({ workspaceId: workspace2._id });

      await fillDatabaseWithMockedData({
        workspace: workspace1,
        project: project1,
        eventsToMock: 15, // Exceeds limit
      });

      await fillDatabaseWithMockedData({
        workspace: workspace2,
        project: project2,
        eventsToMock: 100, // Within limit
      });

      // Mock project as already banned in Redis
      await redisClient.sAdd('DisabledProjectsSet', project2._id.toString());

      /**
       * Act
       */
      const worker = new LimiterWorker();

      await worker.start();
      await worker.handle(REGULAR_WORKSPACES_CHECK_EVENT);
      await worker.finish();

      /**
       * Assert
       */
      expect(telegram.sendMessage).toHaveBeenCalled();
      expect(telegram.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('🔐 <b>[ Limiter / Regular ]</b>'),
        telegram.TelegramBotURLs.Limiter
      );

      const reportMessage = (telegram.sendMessage as jest.Mock).mock.calls[0][0];

      expect(reportMessage).toContain(`⛔️ Workspace <b>${workspace1.name}</b> blocked <b>(id: <code>${workspace1._id}</code>)</b>`);
      expect(reportMessage).toContain(`<b>Quota: ${workspace1.billingPeriodEventsCount} of ${mockedPlans.eventsLimit10.eventsLimit}</b>`);
      expect(reportMessage).not.toContain(workspace2._id.toString());

      expect(reportMessage).toContain(`${project1.name} (id: <code>${project1._id}</code>)`);
    });

    test('Should not send a report when no projects are blocked or unblocked', async () => {
      /**
       * Arrange
       */
      const workspace = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10000,
        billingPeriodEventsCount: 0,
        lastChargeDate: LAST_CHARGE_DATE,
      });
      const project = createProjectMock({ workspaceId: workspace._id });

      await fillDatabaseWithMockedData({
        workspace,
        project,
        eventsToMock: 100, // Within limit
      });

      /**
       * Act
       */
      const worker = new LimiterWorker();

      await worker.start();
      await worker.handle(REGULAR_WORKSPACES_CHECK_EVENT);
      await worker.finish();

      /**
       * Assert
       */
      expect(telegram.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('block-workspace', () => {
    test('Should block workspace and its projects', async () => {
      /**
       * Arrange
       */
      const workspace = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10,
        billingPeriodEventsCount: 0,
        lastChargeDate: LAST_CHARGE_DATE,
        isBlocked: false,
      });
      const project = createProjectMock({ workspaceId: workspace._id });

      await fillDatabaseWithMockedData({
        workspace,
        project,
        eventsToMock: 5,
      });

      const blockEvent: BlockWorkspaceEvent = {
        type: 'block-workspace',
        workspaceId: workspace._id.toString(),
      };

      /**
       * Act
       */
      const worker = new LimiterWorker();

      await worker.start();
      await worker.handle(blockEvent);
      await worker.finish();

      /**
       * Assert
       */
      const updatedWorkspace = await workspaceCollection.findOne({ _id: workspace._id });
      const blockedProjects = await redisClient.sMembers('DisabledProjectsSet');

      expect(updatedWorkspace.isBlocked).toBe(true);
      expect(updatedWorkspace.blockedDate).toBeInstanceOf(Date);
      expect(blockedProjects).toContain(project._id.toString());
      expect(telegram.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('⛔️ Workspace <b>Mocked workspace</b> blocked <b>(id: <code>'),
        telegram.TelegramBotURLs.Limiter
      );

      const reportMessage = (telegram.sendMessage as jest.Mock).mock.calls[0][0];

      expect(reportMessage).toContain('Quota:');
      expect(reportMessage).toContain('Last Charge Date:');
      expect(reportMessage).toContain('Projects added to Redis:');
      expect(reportMessage).toContain('• Mocked project (id: <code>');
    });
  });

  describe('unblock-workspace', () => {
    test('Should unblock workspace and its projects if quota allows', async () => {
      /**
       * Arrange
       */
      const workspace = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10000,
        billingPeriodEventsCount: 0,
        lastChargeDate: LAST_CHARGE_DATE,
        isBlocked: true,
        blockedDate: new Date(),
      });
      const project = createProjectMock({ workspaceId: workspace._id });

      await fillDatabaseWithMockedData({
        workspace,
        project,
        eventsToMock: 100, // Within limit
      });

      // Mock project as banned in Redis
      await redisClient.sAdd('DisabledProjectsSet', project._id.toString());

      const unblockEvent: UnblockWorkspaceEvent = {
        type: 'unblock-workspace',
        workspaceId: workspace._id.toString(),
      };

      /**
       * Act
       */
      const worker = new LimiterWorker();

      await worker.start();
      await worker.handle(unblockEvent);
      await worker.finish();

      /**
       * Assert
       */
      const updatedWorkspace = await workspaceCollection.findOne({ _id: workspace._id });
      const blockedProjects = await redisClient.sMembers('DisabledProjectsSet');

      expect(updatedWorkspace.isBlocked).toBe(false);
      expect(updatedWorkspace.blockedDate).toBeNull();
      expect(blockedProjects).not.toContain(project._id.toString());
      expect(telegram.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('✅ Workspace <b>Mocked workspace</b> unblocked <b>(id: <code>'),
        telegram.TelegramBotURLs.Limiter
      );

      const reportMessage = (telegram.sendMessage as jest.Mock).mock.calls[0][0];

      expect(reportMessage).toContain('Quota:');
      expect(reportMessage).toContain('Last Charge Date:');
      expect(reportMessage).toContain('Projects removed from Redis:');
      expect(reportMessage).toContain('• Mocked project (id: <code>');
    });

    test('Should not unblock workspace if quota is exceeded', async () => {
      /**
       * Arrange
       */
      const workspace = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10,
        billingPeriodEventsCount: 0,
        lastChargeDate: LAST_CHARGE_DATE,
        isBlocked: true,
      });
      const project = createProjectMock({ workspaceId: workspace._id });

      await fillDatabaseWithMockedData({
        workspace,
        project,
        eventsToMock: 15, // Exceeds limit
      });

      // Mock project as banned in Redis
      await redisClient.sAdd('DisabledProjectsSet', project._id.toString());

      const unblockEvent: UnblockWorkspaceEvent = {
        type: 'unblock-workspace',
        workspaceId: workspace._id.toString(),
      };

      /**
       * Act
       */
      const worker = new LimiterWorker();

      await worker.start();
      await worker.handle(unblockEvent);
      await worker.finish();

      /**
       * Assert
       */
      const updatedWorkspace = await workspaceCollection.findOne({ _id: workspace._id });
      const blockedProjects = await redisClient.sMembers('DisabledProjectsSet');

      expect(updatedWorkspace.isBlocked).toBe(true);
      expect(blockedProjects).toContain(project._id.toString());
    });
  });

  afterAll(async () => {
    await connection.close();
    await redisClient.quit();
  });
});
