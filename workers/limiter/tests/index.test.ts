import { MongoClient, ObjectId } from 'mongodb';
import '../../../env-test';
import { PlanDBScheme, ProjectDBScheme, WorkspaceDBScheme } from 'hawk.types';
import { mockedEvents } from './events.mock';
import { mockedRepetitions } from './repetitions.mock';
import LimiterWorker from '../src';

/**
 * Set test date at 01.05.2020 12:00 so that tests pass always at the same time
 */
// eslint-disable-next-line no-extend-native
Date.prototype.getTime = (): number => 1588334400 * 1000;

const mockedWorkspace: WorkspaceDBScheme = {
  _id: new ObjectId('5e4ff518628a6c714515f4de'),
  accountId: '',
  balance: 0,
  lastChargeDate: new Date(1584989425 * 1000),
  name: 'Test workspace',
  tariffPlanId: new ObjectId('5e4ff518628a6c714515f4dh'),
  billingPeriodEventsCount: 0,
};

const mockedProject: ProjectDBScheme = {
  notifications: [],
  token: '5342',
  uidAdded: new ObjectId('5e4ff518628a6c714515f4db'),
  workspaceId: new ObjectId('5e4ff518628a6c714515f4de'),
  _id: new ObjectId('5e4ff518628a6c714515f4da'),
  name: 'Test project',
};

const mockedPlan: PlanDBScheme = {
  _id: new ObjectId('5e4ff518628a6c714515f4dh'),
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

    console.log(workspace);
    expect(workspace).toBeDefined();
  });

  test('Should put banned projects to redis', () => {
    // Do something
  });

  afterAll(async () => {
    await connection.close();
    await db.close();
  });
});
