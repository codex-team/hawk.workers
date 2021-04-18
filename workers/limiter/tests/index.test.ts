import { Collection, Db, MongoClient, ObjectId } from 'mongodb';
import '../../../env-test';
import { GroupedEventDBScheme, PlanDBScheme, ProjectDBScheme, WorkspaceDBScheme } from 'hawk.types';
import LimiterWorker from '../src';
import redis from 'redis';
import { mockedPlans } from './plans.mock';
import axios from 'axios';
import { mocked } from 'ts-jest/utils';
import { MS_IN_SEC } from '../../../lib/utils/consts';
import { RegularWorkspacesCheckEvent } from '../types/eventTypes';

/**
 * Mock axios for testing report sends
 */
jest.mock('axios');

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
   * @param parameters - parameters for creating workspace
   * @param parameters.plan - workspace plan
   * @param parameters.billingPeriodEventsCount - billing period events count
   * @param parameters.lastChargeDate - workspace last charge date
   */
  const createWorkspaceMock = (parameters: {
    plan: PlanDBScheme;
    billingPeriodEventsCount: number;
    lastChargeDate: Date;
  }): WorkspaceDBScheme => {
    return {
      _id: new ObjectId(),
      name: 'Mocked workspace',
      tariffPlanId: parameters.plan._id,
      billingPeriodEventsCount: parameters.billingPeriodEventsCount,
      lastChargeDate: parameters.lastChargeDate,
      accountId: '',
      balance: 0,
    };
  };

  /**
   * Returns mocked project
   *
   * @param parameters - parameters for creating project
   * @param parameters.workspaceId - project workspace id
   */
  const createProjectMock = (parameters: { workspaceId: ObjectId }): ProjectDBScheme => {
    return {
      _id: new ObjectId(),
      name: 'Mocked project',
      workspaceId: parameters.workspaceId,
      notifications: [],
      token: '',
      uidAdded: undefined,
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
        timestamp: 1586892935,
      },
    };
  };

  /**
   * Fills database with workspace, project and events for this project
   *
   * @param parameters - parameters for filling database
   * @param parameters.workspace - mocked workspace for adding to database
   * @param parameters.project - mocked project for adding to database
   * @param parameters.eventsToMock - count of mocked events for project
   */
  const fillDatabaseWithMockedData = async (parameters: {
    workspace: WorkspaceDBScheme,
    project: ProjectDBScheme,
    eventsToMock: number
  }): Promise<void> => {
    const eventsCollection = db.collection(`events:${parameters.project._id.toString()}`);

    await workspaceCollection.insertOne(parameters.workspace);
    await projectCollection.insertOne(parameters.project);
    const mockedEvents: GroupedEventDBScheme[] = [];

    for (let i = 0; i < parameters.eventsToMock; i++) {
      mockedEvents.push(createEventMock());
    }
    await eventsCollection.insertMany(mockedEvents);
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
    redisClient = redis.createClient({ url: process.env.REDIS_URL });

    /**
     * Insert mocked plans for using in tests
     */
    await planCollection.insertMany(Object.values(mockedPlans));
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
      const eventsCollection = db.collection(`events:${project._id.toString()}`);
      const repetitionsCollection = db.collection(`repetitions:${project._id.toString()}`);

      await fillDatabaseWithMockedData({
        workspace,
        project,
        eventsToMock: 5,
      });

      /**
       * Act
       *
       * Worker initialization
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

      /**
       * Count events and repetitions since last charge date
       */
      const since = Math.floor(new Date(workspace.lastChargeDate).getTime() / MS_IN_SEC);
      const query = {
        'payload.timestamp': {
          $gt: since,
        },
      };
      const repetitionsCount = await repetitionsCollection.find(query).count();
      const eventsCount = await eventsCollection.find(query).count();

      /**
       * Check count of events
       */
      expect(workspaceInDatabase.billingPeriodEventsCount).toEqual(repetitionsCount + eventsCount);
    });

    test('Should ban projects that have exceeded the plan limit and add their ids to redis', async (done) => {
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
       *
       * Worker initialization
       */
      const worker = new LimiterWorker();

      await worker.start();
      await worker.handle(REGULAR_WORKSPACES_CHECK_EVENT);
      await worker.finish();

      /**
       * Assert
       *
       * Gets all members of set with key 'DisabledProjectsSet' from Redis
       */
      redisClient.smembers('DisabledProjectsSet', (err, result) => {
        expect(err).toBeNull();
        expect(result).toContain(project._id.toString());
        done();
      });
    });

    test('Should unban previously banned projects if the limit allows', async (done) => {
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
       *
       * Worker initialization
       */
      const worker = new LimiterWorker();

      await worker.start();
      await worker.handle(REGULAR_WORKSPACES_CHECK_EVENT);

      /**
       * Gets all members of set with key 'DisabledProjectsSet' from Redis
       * Project should be banned
       */
      redisClient.smembers('DisabledProjectsSet', (err, result) => {
        expect(err).toBeNull();
        expect(result).toContain(project._id.toString());
      });

      /**
       * Change workspace plan to plan with big events limit
       */
      await workspaceCollection.findOneAndUpdate({ _id: workspace._id }, {
        $set: {
          tariffPlanId: mockedPlans.eventsLimit10000._id,
        },
      });

      await worker.handle(REGULAR_WORKSPACES_CHECK_EVENT);
      await worker.finish();

      /**
       * Assert
       *
       * Gets all members of set with key 'DisabledProjectsSet' from Redis
       */
      redisClient.smembers('DisabledProjectsSet', (err, result) => {
        expect(err).toBeNull();
        expect(result).not.toContain(project._id.toString());
        done();
      });
    });

    test('Should not ban project if it does not reach the limit', async (done) => {
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
       *
       * Worker initialization
       */
      const worker = new LimiterWorker();

      await worker.start();
      await worker.handle(REGULAR_WORKSPACES_CHECK_EVENT);
      await worker.finish();

      /**
       * Assert
       *
       * Gets all members of set with key 'DisabledProjectsSet' from Redis
       */
      redisClient.smembers('DisabledProjectsSet', (err, result) => {
        expect(err).toBeNull();

        /**
         * Redis shouldn't contain id of project 'Test project #2' from 'Test workspace #2'
         */
        expect(result).not.toContain(project._id.toString());
        done();
      });
    });

    test('Should send a report with collected data', async () => {
      /**
       * Arrange
       *
       * Worker initialization
       */
      const worker = new LimiterWorker();

      mocked(axios).mockResolvedValue({
        data: {},
        status: 200,
        statusText: 'OK',
        config: {},
        headers: {},
      });

      /**
       * Act
       */
      await worker.start();
      await worker.handle(REGULAR_WORKSPACES_CHECK_EVENT);
      await worker.finish();

      /**
       * Assert
       */
      expect(axios).toHaveBeenCalled();
      expect(axios).toHaveBeenCalledWith({
        method: 'post',
        url: process.env.REPORT_NOTIFY_URL,
        data: expect.any(String),
      });
    });
  });

  describe('check-single-workspace', () => {
    test('Should unblock workspace if the number of events does not exceed the limit', async (done) => {
      /**
       * Arrange
       *
       * Worker initialization
       */
      const worker = new LimiterWorker();

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

      mocked(axios).mockResolvedValue({
        data: {},
        status: 200,
        statusText: 'OK',
        config: {},
        headers: {},
      });

      /**
       * Act
       */
      await worker.start();
      await worker.handle({
        type: 'check-single-workspace',
        workspaceId: workspace._id.toString(),
      });
      await worker.finish();

      /**
       * Assert
       */
      expect(axios).toHaveBeenCalled();
      expect(axios).toHaveBeenCalledWith({
        method: 'post',
        url: process.env.REPORT_NOTIFY_URL,
        data: expect.any(String),
      });

      /**
       * Gets all members of set with key 'DisabledProjectsSet' from Redis
       */
      redisClient.smembers('DisabledProjectsSet', (err, result) => {
        expect(err).toBeNull();

        /**
         * Redis shouldn't contain id of project 'Test project #2' from 'Test workspace #2'
         */
        expect(result).not.toContain(project._id.toString());
        done();
      });
    });

    test('Should block workspace if the number of events exceed the limit', async (done) => {
      /**
       * Arrange
       *
       * Worker initialization
       */
      const worker = new LimiterWorker();

      const workspace = createWorkspaceMock({
        plan: mockedPlans.eventsLimit10,
        billingPeriodEventsCount: 0,
        lastChargeDate: LAST_CHARGE_DATE,
      });
      const project = createProjectMock({ workspaceId: workspace._id });

      await fillDatabaseWithMockedData({
        workspace,
        project,
        eventsToMock: 100,
      });

      mocked(axios).mockResolvedValue({
        data: {},
        status: 200,
        statusText: 'OK',
        config: {},
        headers: {},
      });

      /**
       * Act
       */
      await worker.start();
      await worker.handle({
        type: 'check-single-workspace',
        workspaceId: workspace._id.toString(),
      });
      await worker.finish();

      /**
       * Assert
       */
      expect(axios).toHaveBeenCalled();
      expect(axios).toHaveBeenCalledWith({
        method: 'post',
        url: process.env.REPORT_NOTIFY_URL,
        data: expect.any(String),
      });

      /**
       * Gets all members of set with key 'DisabledProjectsSet' from Redis
       */
      redisClient.smembers('DisabledProjectsSet', (err, result) => {
        expect(err).toBeNull();

        /**
         * Redis shouldn't contain id of the mocked project
         */
        expect(result).toContain(project._id.toString());
        done();
      });
    });
  });

  afterAll(async () => {
    await connection.close();
  });
});
