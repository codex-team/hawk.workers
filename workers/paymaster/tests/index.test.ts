import PaymasterWorker from '../src';
import { Collection, MongoClient, ObjectId } from 'mongodb';
import '../../../env-test';
import { EventType } from '../types/paymaster-worker-events';
import { PlanDBScheme, WorkspaceDBScheme, BusinessOperationDBScheme, BusinessOperationStatus, BusinessOperationType } from 'hawk.types';
import MockDate from 'mockdate';
import Accounting from 'codex-accounting-sdk';
import { v4 as uuid } from 'uuid';

jest.mock('codex-accounting-sdk');
jest.mock('axios');

(Accounting.prototype.purchase as jest.Mock).mockImplementation(() => Promise.resolve({
  recordId: uuid(),
}));

const mockedDate = new Date('2005-12-22');

const plan: PlanDBScheme = {
  eventsLimit: 10000,
  _id: new ObjectId('5eec1fcde748a04c16632ae2'),
  monthlyCharge: 1000,
  name: 'Mocked plan',
  isDefault: false,
};

const freePlan = {
  eventsLimit: 1000,
  _id: new ObjectId('5eec1fcde748a04c16632ae3'),
  monthlyCharge: 0,
  name: 'Mocked free plan',
  isDefault: true,
};

const workspace: WorkspaceDBScheme = {
  balance: 10000,
  name: 'My workspace',
  _id: new ObjectId('5e5fb6303e3a9d0a1933739a'),
  tariffPlanId: plan._id,
  lastChargeDate: new Date('2005-11-22'),
  accountId: '34562453',
  billingPeriodEventsCount: 0,
};

describe('PaymasterWorker', () => {
  const worker = new PaymasterWorker();
  let connection: MongoClient;
  let workspacesCollection: Collection<WorkspaceDBScheme>;
  let tariffCollection: Collection<PlanDBScheme>;
  let businessOperationsCollection: Collection<BusinessOperationDBScheme>;

  beforeAll(async () => {
    connection = await MongoClient.connect(process.env.MONGO_EVENTS_DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    workspacesCollection = connection.db().collection<WorkspaceDBScheme>('workspaces');
    tariffCollection = connection.db().collection<PlanDBScheme>('plans');
    businessOperationsCollection = connection.db().collection<BusinessOperationDBScheme>('businessOperations');

    await tariffCollection.insertMany([plan, freePlan]);

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
      type: EventType.WorkspacePlanCharge,
      payload: undefined,
    });

    const updatedWorkspace = await workspacesCollection.findOne({ _id: workspace._id });

    expect(updatedWorkspace.lastChargeDate).toEqual(mockedDate);
    MockDate.reset();
  });

  test(`Shouldn't trigger purchasing of the workspace plan if today is not payday`, async () => {
    MockDate.set(new Date('2005-12-20'));

    await worker.handle({
      type: EventType.WorkspacePlanCharge,
      payload: undefined,
    });

    const businessOperation = await businessOperationsCollection.findOne({});

    expect(businessOperation).toEqual(null);

    MockDate.reset();
  });

  test(`Shouldn't trigger purchasing of the workspace plan if plan is free`, async () => {
    MockDate.set(mockedDate);

    /**
     * Change tariff plan for mocked workspace for this test
     */
    await workspacesCollection.updateOne({ _id: workspace._id }, {
      $set: {
        tariffPlanId: freePlan._id,
      },
    });

    await worker.handle({
      type: EventType.WorkspacePlanCharge,
      payload: undefined,
    });

    const businessOperation = await businessOperationsCollection.findOne({});

    expect(businessOperation).toEqual(null);

    MockDate.reset();
  });

  test('Should trigger purchasing of the workspace plan if today is payday', async () => {
    MockDate.set(mockedDate);

    await worker.handle({
      type: EventType.WorkspacePlanCharge,
      payload: undefined,
    });

    const businessOperation = await businessOperationsCollection.findOne({});

    expect(businessOperation).toEqual(expect.objectContaining({
      _id: expect.any(ObjectId),
      type: BusinessOperationType.WorkspacePlanPurchase,
      transactionId: expect.any(String),
      payload: {
        amount: 100000,
        workspaceId: workspace._id,
      },
      status: BusinessOperationStatus.Confirmed,
      dtCreated: mockedDate,
    } as BusinessOperationDBScheme));

    MockDate.reset();
  });

  test('Should trigger purchasing of the workspace plan if last charge date is not defined', async () => {
    MockDate.set(mockedDate);

    /**
     * Remove lastChargeDate for mocked workspace for this test
     */
    await workspacesCollection.updateOne({ _id: workspace._id }, {
      $set: {
        lastChargeDate: undefined,
      },
    });

    await worker.handle({
      type: EventType.WorkspacePlanCharge,
      payload: undefined,
    });

    const businessOperation = await businessOperationsCollection.findOne({});

    expect(businessOperation).toEqual(expect.objectContaining({
      _id: expect.any(ObjectId),
      type: BusinessOperationType.WorkspacePlanPurchase,
      transactionId: expect.any(String),
      payload: {
        amount: 100000,
        workspaceId: workspace._id,
      },
      status: BusinessOperationStatus.Confirmed,
      dtCreated: mockedDate,
    } as BusinessOperationDBScheme));

    MockDate.reset();
  });

  test('Should trigger purchasing of the workspace plan if payday has come recently', async () => {
    MockDate.set(new Date('2005-12-25'));

    await worker.handle({
      type: EventType.WorkspacePlanCharge,
      payload: undefined,
    });

    const businessOperation = await businessOperationsCollection.findOne({});

    expect(businessOperation).toEqual(expect.objectContaining({
      _id: expect.any(ObjectId),
      type: BusinessOperationType.WorkspacePlanPurchase,
      transactionId: expect.any(String),
      payload: {
        amount: 100000,
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
