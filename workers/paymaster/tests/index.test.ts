import PaymasterWorker from '../src';
import { Collection, MongoClient, ObjectId } from 'mongodb';
import '../../../env-test';
import './rabbit.mock';
import { EventType } from '../types/paymaster-worker-events';
import Workspace from '../../../lib/types/workspace';
import TariffPlan from '../../../lib/types/tariffPlan';
import Transaction from '../../../lib/types/transaction';

jest.mock('amqplib');

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
  lastChargeDate: new Date(2020, 8, 1),
};

describe('PaymasterWorker', () => {
  const worker = new PaymasterWorker();
  let connection: MongoClient;
  let workspacesCollection: Collection<Workspace>;
  let tariffCollection: Collection<TariffPlan>;
  let transactionsCollection: Collection<Transaction>;

  beforeAll(async () => {
    await worker.start();
    connection = await MongoClient.connect(process.env.MONGO_EVENTS_DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    workspacesCollection = connection.db().collection<Workspace>('workspaces');
    tariffCollection = connection.db().collection<TariffPlan>('tariff_plans');
  });

  beforeEach(async () => {
    await workspacesCollection.deleteMany({});
    await tariffCollection.deleteMany({});
    await transactionsCollection.deleteMany({});

    await workspacesCollection.insertOne(workspace);
    await tariffCollection.insertOne(plan);
  });

  test('Should change lastChargeDate for workspace', async () => {
    await worker.handle({
      type: EventType.DailyCheck,
      payload: undefined,
    });

    const updatedWorkspace = await workspacesCollection.findOne({ _id: workspace._id });

    const now = new Date();

    expect(updatedWorkspace.lastChargeDate.getMonth()).toEqual(now.getMonth());
    expect(updatedWorkspace.lastChargeDate.getFullYear()).toEqual(now.getFullYear());
    expect(updatedWorkspace.lastChargeDate.getDate()).toEqual(now.getDate());
  });

  test('Should correctly calculate amount of money to write off', async () => {
    await worker.handle({
      type: EventType.DailyCheck,
      payload: undefined,
    });

    const transaction = await transactionsCollection.findOne({});

    expect(transaction).toEqual(expect.objectContaining({
      _id: expect.any(ObjectId),
      type: 'charge',
      amount: 100,
      workspace: workspace._id,
      date: expect.any(Date),
      user: expect.any(ObjectId),
    } as Transaction));
  });
});
