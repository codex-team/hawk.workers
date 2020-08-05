import PaymasterWorker from '../src';
import {Collection, MongoClient, ObjectId} from 'mongodb';
import '../../../env-test';
import './rabbit.mock';
import {EventType} from '../types/paymaster-worker-events';
import Workspace from '../../../lib/types/workspace';
import TariffPlan from '../../../lib/types/tariffPlan';
import {
  BusinessOperationDBScheme,
  BusinessOperationStatus,
  BusinessOperationType
} from '../../../lib/types/businessOperation';
import MockDate from 'mockdate';

jest.mock('amqplib');
const mockedDate = new Date('2005-11-22');

const plan: TariffPlan = {
  eventsLimit: 10000,
  _id: new ObjectId('5eec1fcde748a04c16632ae2'),
  monthlyCharge: 100,
  name: 'Mocked plan',
};

const workspace: Workspace = {
  balance: 100000,
  name: 'My workspace',
  _id: new ObjectId('5e5fb6303e3a9d0a1933739a'),
  tariffPlanId: plan._id,
  lastChargeDate: new Date(2003, 8, 1),
};

describe('PaymasterWorker', () => {
  const worker = new PaymasterWorker();
  let connection: MongoClient;
  let workspacesCollection: Collection<Workspace>;
  let tariffCollection: Collection<TariffPlan>;
  let businessOperationsCollection: Collection<BusinessOperationDBScheme>;

  beforeAll(async () => {
    MockDate.set(mockedDate);

    connection = await MongoClient.connect(process.env.MONGO_EVENTS_DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    workspacesCollection = connection.db().collection<Workspace>('workspaces');
    tariffCollection = connection.db().collection<TariffPlan>('tariff_plans');
    businessOperationsCollection = connection.db().collection<BusinessOperationDBScheme>('business_operations');

    await tariffCollection.insertOne(plan);

    await worker.start();
  });

  beforeEach(async () => {
    await workspacesCollection.deleteMany({});
    await businessOperationsCollection.deleteMany({});

    await workspacesCollection.insertOne(workspace);
  });

  test('Should change lastChargeDate for workspace', async () => {
    await worker.handle({
      type: EventType.DailyCheck,
      payload: undefined,
    });

    const updatedWorkspace = await workspacesCollection.findOne({ _id: workspace._id });

    expect(updatedWorkspace.lastChargeDate).toEqual(mockedDate);
  });

  test('Should correctly calculate amount of money to write off', async () => {
    await worker.handle({
      type: EventType.DailyCheck,
      payload: undefined,
    });

    const transaction = await businessOperationsCollection.findOne({});

    expect(transaction).toEqual(expect.objectContaining({
      _id: expect.any(ObjectId),
      type: BusinessOperationType.WorkspacePlanPurchase,
      transactionId: expect.any(String),
      payload: {
        amount: 100,
        workspaceId: workspace._id,
      },
      status: BusinessOperationStatus.Confirmed,
      dtCreated: mockedDate,
    } as BusinessOperationDBScheme));
  });

  afterAll(async () => {
    await worker.finish();
    await connection.close();
    MockDate.reset();
  });
});
