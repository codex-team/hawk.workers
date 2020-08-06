import PaymasterWorker from '../src';
import { Collection, MongoClient, ObjectId } from 'mongodb';
import '../../../env-test';
import './rabbit.mock';
import { EventType } from '../types/paymaster-worker-events';
import Workspace from '../../../lib/types/workspace';
import TariffPlan from '../../../lib/types/tariffPlan';
import {
  BusinessOperationDBScheme,
  BusinessOperationStatus,
  BusinessOperationType
} from '../../../lib/types/businessOperation';
import MockDate from 'mockdate';
import axios from 'axios';
import { v4 as uuid } from 'uuid';

jest.mock('amqplib');
jest.mock('axios');

(axios.post as jest.Mock).mockImplementation(() => Promise.resolve({
  data: {
    data: {
      purchase: {
        recordId: uuid(),
      },
    },
  },
}));

const mockedDate = new Date('2005-12-22');

const plan: TariffPlan = {
  eventsLimit: 10000,
  _id: new ObjectId('5eec1fcde748a04c16632ae2'),
  monthlyCharge: 1000,
  name: 'Mocked plan',
};

const workspace: Workspace = {
  balance: 10000,
  name: 'My workspace',
  _id: new ObjectId('5e5fb6303e3a9d0a1933739a'),
  tariffPlanId: plan._id,
  lastChargeDate: new Date('2005-11-22'),
  accountId: '34562453',
};

describe('PaymasterWorker', () => {
  const worker = new PaymasterWorker();
  let connection: MongoClient;
  let workspacesCollection: Collection<Workspace>;
  let tariffCollection: Collection<TariffPlan>;
  let businessOperationsCollection: Collection<BusinessOperationDBScheme>;

  beforeAll(async () => {
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
    MockDate.set(mockedDate);

    await worker.handle({
      type: EventType.DailyCheck,
      payload: undefined,
    });

    const updatedWorkspace = await workspacesCollection.findOne({ _id: workspace._id });

    expect(updatedWorkspace.lastChargeDate).toEqual(mockedDate);
    MockDate.reset();
  });

  test(`Shouldn't write off workspace balance if today is not payday`, async () => {
    MockDate.set(new Date('2005-12-20'));

    await worker.handle({
      type: EventType.DailyCheck,
      payload: undefined,
    });

    const transaction = await businessOperationsCollection.findOne({});

    expect(transaction).toEqual(null);

    MockDate.reset();
  });

  test('Should write off workspace balance if today is payday', async () => {
    MockDate.set(mockedDate);

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
        amount: 1000,
        workspaceId: workspace._id,
      },
      status: BusinessOperationStatus.Confirmed,
      dtCreated: mockedDate,
    } as BusinessOperationDBScheme));

    MockDate.reset();
  });

  test('Should write off workspace balance if payday has come recently', async () => {
    MockDate.set(new Date('2005-12-25'));

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
        amount: 1000,
        workspaceId: workspace._id,
      },
      status: BusinessOperationStatus.Confirmed,
      dtCreated: new Date('2005-12-25'),
    } as BusinessOperationDBScheme));

    MockDate.reset();
  });

  afterAll(async () => {
    await worker.finish();
    await connection.close();
    MockDate.reset();
  });
});
