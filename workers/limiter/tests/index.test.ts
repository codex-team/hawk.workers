import { Collection, Db, MongoClient } from 'mongodb';
import '../../../env-test';
import { PlanDBScheme, ProjectDBScheme, WorkspaceDBScheme } from 'hawk.types';
import { mockedEvents } from './events.mock';
import { mockedRepetitions } from './repetitions.mock';
import LimiterWorker from '../src';
import redis from 'redis';
import { mockedPlans } from './plans.mock';
import axios from 'axios';
import { mocked } from 'ts-jest/utils';
import { mockedProjects } from './projects.mock';
import { mockedWorkspaces } from './workspaces.mock';
import { MS_IN_SEC } from '../../../lib/utils/consts';

/**
 * Mock axios for testing report sends
 */
jest.mock('axios');

describe('Limiter worker', () => {
  let connection: MongoClient;
  let db: Db;
  let projectCollection: Collection<ProjectDBScheme>;
  let workspaceCollection: Collection<WorkspaceDBScheme>;
  let planCollection: Collection<PlanDBScheme>;
  let redisClient;

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
    await planCollection.insertMany(mockedPlans);
  });

  test('Should count workspace events for a billing period and save it to the db', async () => {
    /**
     * Arrange
     */
    const workspace = mockedWorkspaces[0];
    const project = mockedProjects[0];
    const eventsCollection = db.collection(`events:${project._id.toString()}`);
    const repetitionsCollection = db.collection(`repetitions:${project._id.toString()}`);

    await workspaceCollection.insertOne(workspace);
    await projectCollection.insertOne(project);
    await eventsCollection.insertMany(mockedEvents);
    await repetitionsCollection.insertMany(mockedRepetitions);

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
    const workspace = mockedWorkspaces[3];
    const project = mockedProjects[3];
    const eventsCollection = db.collection(`events:${project._id.toString()}`);
    const repetitionsCollection = db.collection(`repetitions:${project._id.toString()}`);

    await workspaceCollection.insertOne(workspace);
    await projectCollection.insertOne(project);
    await eventsCollection.insertMany(mockedEvents);
    await repetitionsCollection.insertMany(mockedRepetitions);

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
    const workspace = mockedWorkspaces[2];
    const project = mockedProjects[2];
    const eventsCollection = db.collection(`events:${project._id.toString()}`);
    const repetitionsCollection = db.collection(`repetitions:${project._id.toString()}`);

    await workspaceCollection.insertOne(workspace);
    await projectCollection.insertOne(project);
    await eventsCollection.insertMany(mockedEvents);
    await repetitionsCollection.insertMany(mockedRepetitions);

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
        tariffPlanId: mockedPlans[1]._id,
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
    const workspace = mockedWorkspaces[1];
    const project = mockedProjects[1];
    const eventsCollection = db.collection(`events:${project._id.toString()}`);
    const repetitionsCollection = db.collection(`repetitions:${project._id.toString()}`);

    await workspaceCollection.insertOne(workspace);
    await projectCollection.insertOne(project);
    await eventsCollection.insertMany(mockedEvents);
    await repetitionsCollection.insertMany(mockedRepetitions);

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
