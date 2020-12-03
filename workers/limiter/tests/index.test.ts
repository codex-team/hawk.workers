import { MongoClient, ObjectId } from 'mongodb';
import '../../../env-test';
import { PlanDBScheme, ProjectDBScheme, WorkspaceDBScheme } from 'hawk.types';
import { mockedEvents } from './events.mock';
import { mockedRepetitions } from './repetitions.mock';
import LimiterWorker from '../src';
import redis from 'redis';

const mockedWorkspace: WorkspaceDBScheme = {
  _id: new ObjectId('5e4ff518628a6c714615f4de'),
  accountId: '',
  balance: 0,
  lastChargeDate: new Date(1585742400 * 1000),
  name: 'Test workspace',
  tariffPlanId: new ObjectId('5e4ff528628a6c714515f4dc'),
  billingPeriodEventsCount: 0,
};

const mockedProject: ProjectDBScheme = {
  notifications: [],
  token: '5342',
  uidAdded: new ObjectId('5e4ff518628a6c714515f4db'),
  workspaceId: new ObjectId('5e4ff518628a6c714615f4de'),
  _id: new ObjectId('5e4ff518618a6c714515f4da'),
  name: 'Test project',
};

const mockedPlan: PlanDBScheme = {
  _id: new ObjectId('5e4ff528628a6c714515f4dc'),
  name: 'Test plan',
  monthlyCharge: 10,
  eventsLimit: 10,
  isDefault: true,
};

describe('Limiter worker', () => {
  let connection;
  let db;
  let repetitionsCollection;
  let eventsCollection;
  let projectCollection;
  let workspaceCollection;
  let planCollection;
  let redisClient;

  beforeAll(async () => {
    connection = await MongoClient.connect(process.env.MONGO_ACCOUNTS_DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    db = await connection.db('hawk');
    projectCollection = db.collection('projects');
    workspaceCollection = db.collection('workspaces');
    planCollection = db.collection('plans');
    repetitionsCollection = db.collection(`repetitions:${mockedProject._id.toString()}`);
    eventsCollection = db.collection(`events:${mockedProject._id.toString()}`);

    await workspaceCollection.insertOne(mockedWorkspace);
    await projectCollection.insertOne(mockedProject);
    await planCollection.insertOne(mockedPlan);
    await repetitionsCollection.insertMany(mockedRepetitions);
    await eventsCollection.insertMany(mockedEvents);
    redisClient = redis.createClient({ url: process.env.REDIS_URL });
  });

  test('Should correctly count billing period events', async () => {
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
    const workspace = await workspaceCollection.findOne({
      _id: mockedWorkspace._id,
    });

    expect(workspace.billingPeriodEventsCount).toEqual(18);
  });

  test('Should put banned projects to redis', async (done) => {
    /**
     * Worker initialization
     */
    const worker = new LimiterWorker();

    await worker.start();
    await worker.handle();
    await worker.finish();

    redisClient.smembers('DisabledProjectsSet', (err, result) => {
      expect(err).toBeNull();
      expect(result).toContain(mockedProject._id.toString());
      done();
    });
  });

  afterAll(async () => {
    await connection.close();
    await db.close();
    redisClient.end();
  });
});
