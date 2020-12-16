import { Collection, Db, MongoClient, ObjectId } from 'mongodb';
import '../../../env-test';
import { PlanDBScheme, ProjectDBScheme, WorkspaceDBScheme } from 'hawk.types';
import { mockedEvents } from './events.mock';
import { mockedRepetitions } from './repetitions.mock';
import LimiterWorker from '../src';
import redis from 'redis';
import { mockedPlans } from './plans.mock';
import axios from 'axios';
import { mocked } from 'ts-jest/utils';
import { MS_IN_SEC } from '../../../lib/utils/consts';

/**
 * Mock axios for testing report sends
 */
jest.mock('axios');

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
   * @param plan - workspace plan
   * @param billingPeriodEventsCount - billing period events count
   * @param lastChargeDate - workspace last charge date
   */
  const createWorkspaceMock = ({
    plan,
    billingPeriodEventsCount,
    lastChargeDate,
  }: {
    plan: PlanDBScheme;
    billingPeriodEventsCount: number;
    lastChargeDate: Date;
  }): WorkspaceDBScheme => {
    return {
      _id: new ObjectId(),
      name: 'Mocked workspace',
      tariffPlanId: plan._id,
      billingPeriodEventsCount,
      lastChargeDate,
      accountId: '',
      balance: 0,
    };
  };

  /**
   * Returns mocked project
   *
   * @param workspaceId - project workspace id
   */
  const createProjectMock = ({ workspaceId }: { workspaceId: ObjectId }): ProjectDBScheme => {
    return {
      _id: new ObjectId(),
      name: 'Mocked project',
      workspaceId,
      notifications: [],
      token: '',
      uidAdded: undefined,
    };
  };

  /**
   * Fills database with workspace, project and events for this project
   *
   * @param workspace - mocked workspace for adding to database
   * @param project - mocked project for adding to database
   */
  const fillDatabaseWithMockedData = async (workspace: WorkspaceDBScheme, project: ProjectDBScheme): Promise<void> => {
    const eventsCollection = db.collection(`events:${project._id.toString()}`);
    const repetitionsCollection = db.collection(`repetitions:${project._id.toString()}`);

    await workspaceCollection.insertOne(workspace);
    await projectCollection.insertOne(project);
    await eventsCollection.insertMany(mockedEvents);
    await repetitionsCollection.insertMany(mockedRepetitions);
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

    await fillDatabaseWithMockedData(workspace, project);

    /**
     * Act
     *
     * Worker initialization
     */
    const worker = new LimiterWorker();

    await worker.start();
    await worker.handle();
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

    await fillDatabaseWithMockedData(workspace, project);

    /**
     * Act
     *
     * Worker initialization
     */
    const worker = new LimiterWorker();

    await worker.start();
    await worker.handle();
    await worker.finish();

    /**
     * Assert
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

    await fillDatabaseWithMockedData(workspace, project);

    /**
     * Act
     *
     * Worker initialization
     */
    const worker = new LimiterWorker();

    await worker.start();
    await worker.handle();

    redisClient.smembers('DisabledProjectsSet', (err, result) => {
      expect(err).toBeNull();
      expect(result).toContain(project._id.toString());
    });

    await workspaceCollection.findOneAndUpdate({ _id: workspace._id }, {
      $set: {
        tariffPlanId: mockedPlans.eventsLimit10000._id,
      },
    });

    await worker.handle();
    await worker.finish();

    /**
     * Assert
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

    await fillDatabaseWithMockedData(workspace, project);

    /**
     * Act
     *
     * Worker initialization
     */
    const worker = new LimiterWorker();

    await worker.start();
    await worker.handle();
    await worker.finish();

    /**
     * Assert
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
    await worker.handle();
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

  afterAll(async () => {
    await connection.close();
    redisClient.end();
  });
});
