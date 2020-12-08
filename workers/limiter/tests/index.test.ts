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
import asyncForEach from '../../../lib/utils/asyncForEach';
import { mockedWorkspaces } from './workspaces.mock';
import { MS_IN_SEC } from '../../../lib/utils/consts';

/**
 * Mock axios for testing report sends
 */
jest.mock('axios');

describe('Limiter worker', () => {
  let connection: MongoClient;
  let db: Db;
  const repetitionsCollections: Collection[] = [];
  const eventsCollections: Collection[] = [];
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
    mockedProjects.forEach(project => {
      repetitionsCollections.push(db.collection(`repetitions:${project._id.toString()}`));
      eventsCollections.push(db.collection(`events:${project._id.toString()}`));
    });

    /**
     * Insert mocked data to tests
     */
    await workspaceCollection.insertMany(mockedWorkspaces);
    await projectCollection.insertMany(mockedProjects);
    await planCollection.insertMany(mockedPlans);
    await asyncForEach(repetitionsCollections, async (collection) => {
      await collection.insertMany(mockedRepetitions);
    });
    await asyncForEach(eventsCollections, async (collection) => {
      await collection.insertMany(mockedEvents);
    });
    redisClient = redis.createClient({ url: process.env.REDIS_URL });
  });

  test('Should count billing period events of workspace', async () => {
    /**
     * Compute time since it will count events and repetitions for checking in the end
     */
    let workspace = await workspaceCollection.findOne({
      _id: mockedWorkspaces[0]._id,
    });

    const since = Math.floor(new Date(workspace.lastChargeDate).getTime() / MS_IN_SEC);

    /**
     * Worker initialization
     */
    const worker = new LimiterWorker();

    await worker.start();
    await worker.handle();
    await worker.finish();

    /**
     * Check count of events
     */
    workspace = await workspaceCollection.findOne({
      _id: mockedWorkspaces[0]._id,
    });

    /**
     * Count events and repetitions since last charge date
     */
    const query = {
      'payload.timestamp': {
        $gt: since,
      },
    };
    const repetitionsCount = await repetitionsCollections[0].find(query).count();
    const eventsCount = await eventsCollections[0].find(query).count();

    expect(workspace.billingPeriodEventsCount).toEqual(repetitionsCount + eventsCount);
  });

  test('Should ban projects that have exceeded the plan limit and add their ids to redis', async (done) => {
    /**
     * Worker initialization
     */
    const worker = new LimiterWorker();

    await worker.start();
    await worker.handle();
    await worker.finish();

    redisClient.smembers('DisabledProjectsSet', (err, result) => {
      expect(err).toBeNull();
      expect(result).toContain(mockedProjects[0]._id.toString());
      done();
    });
  });

  // test('Should unban previously banned projects if the limit allows', async (done) => {
  //   /**
  //    * Worker initialization
  //    */
  //   const worker = new LimiterWorker();
  // });
  //
  test('Should not ban project if it does not reach the limit', async (done) => {
    /**
     * Worker initialization
     */
    const worker = new LimiterWorker();

    await worker.start();
    await worker.handle();
    await worker.finish();

    redisClient.smembers('DisabledProjectsSet', (err, result) => {
      expect(err).toBeNull();

      /**
       * Redis shouldn't contain id of project 'Test project #2' from 'Test workspace #2'
       */
      expect(result).not.toContain(mockedProjects[1]._id.toString());
      done();
    });
  });

  test('Should send a report with collected data', async () => {
    /**
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

    await worker.start();
    await worker.handle();
    await worker.finish();

    expect(axios).toHaveBeenCalled();
    expect(axios).toHaveBeenCalledWith({
      method: 'post',
      url: process.env.REPORT_NOTIFY_URL,
      data: expect.any(String),
    });
  });

  afterAll(async () => {
    await connection.close();
    // await db.close();
    redisClient.end();
  });
});
