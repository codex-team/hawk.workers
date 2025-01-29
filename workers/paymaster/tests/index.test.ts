import PaymasterWorker from '../src';
import { Collection, MongoClient, ObjectId } from 'mongodb';
import '../../../env-test';
import { PlanDBScheme, WorkspaceDBScheme } from '@hawk.so/types';
import MockDate from 'mockdate';
import { EventType, PaymasterEvent } from '../types/paymaster-worker-events';
import { mocked } from 'jest-mock';
import axios from 'axios';

/**
 * Mock axios for testing report sends
 */
jest.mock('axios');

const WORKSPACE_SUBSCRIPTION_CHECK: PaymasterEvent = {
  type: EventType.WorkspaceSubscriptionCheck,
};

/**
 * Creates mocked plan with monthly charge
 *
 * @param parameters - parameters for creating plan
 */
const createPlanMock = (parameters: {
  monthlyCharge: number;
  isDefault: boolean
}): PlanDBScheme => {
  return {
    _id: new ObjectId(),
    name: 'Mocked plan',
    monthlyCharge: parameters.monthlyCharge,
    eventsLimit: 10,
    isDefault: parameters.isDefault,
  };
};

/**
 * Returns mocked workspace
 *
 * @param parameters - parameters for creating workspace
 */
const createWorkspaceMock = (parameters: {
  plan: PlanDBScheme;
  billingPeriodEventsCount: number;
  lastChargeDate: Date | undefined;
  subscriptionId: string;
  isBlocked: boolean;
}): WorkspaceDBScheme => {
  return {
    _id: new ObjectId(),
    name: 'Mocked workspace',
    inviteHash: '',
    tariffPlanId: parameters.plan._id,
    billingPeriodEventsCount: parameters.billingPeriodEventsCount,
    lastChargeDate: parameters.lastChargeDate,
    accountId: '',
    balance: 0,
    subscriptionId: parameters.subscriptionId,
    isBlocked: parameters.isBlocked,
  };
};

describe('PaymasterWorker', () => {
  let connection: MongoClient;
  let workspacesCollection: Collection<WorkspaceDBScheme>;
  let tariffCollection: Collection<PlanDBScheme>;

  /**
   * Fills database with workspace and plan
   *
   * @param parameters - parameters for filling database
   */
  const fillDatabaseWithMockedData = async (parameters: {
    workspace: WorkspaceDBScheme,
    plan: PlanDBScheme,
  }): Promise<void> => {
    await workspacesCollection.insertOne(parameters.workspace);
    await tariffCollection.insertOne(parameters.plan);
  };

  beforeAll(async () => {
    connection = await MongoClient.connect(process.env.MONGO_EVENTS_DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    workspacesCollection = connection.db().collection<WorkspaceDBScheme>('workspaces');
    tariffCollection = connection.db().collection<PlanDBScheme>('plans');
  });

  beforeEach(async () => {
    await workspacesCollection.deleteMany({});
    await tariffCollection.deleteMany({});
  });

  test('Should block workspace if it hasn\'t subscription and it\'s time to pay', async () => {
    /**
     * Arrange
     */
    const currentDate = new Date('2005-12-22');
    const plan = createPlanMock({
      monthlyCharge: 100,
      isDefault: true,
    });
    const workspace = createWorkspaceMock({
      plan,
      subscriptionId: null,
      lastChargeDate: new Date('2005-11-22'),
      isBlocked: false,
      billingPeriodEventsCount: 10,
    });

    await fillDatabaseWithMockedData({
      workspace,
      plan,
    });

    MockDate.set(currentDate);

    /**
     * Act
     */
    const worker = new PaymasterWorker();

    await worker.start();
    await worker.handle(WORKSPACE_SUBSCRIPTION_CHECK);
    await worker.finish();

    /**
     * Assert
     */
    const updatedWorkspace = await workspacesCollection.findOne({ _id: workspace._id });

    expect(updatedWorkspace.isBlocked).toEqual(true);
    MockDate.reset();
  });

  test('Shouldn\'t block workspace if it has subscription and after payday passed less than 3 days', async () => {
    /**
     * Arrange
     */
    const currentDate = new Date('2005-12-24');
    const plan = createPlanMock({
      monthlyCharge: 100,
      isDefault: true,
    });
    const workspace = createWorkspaceMock({
      plan,
      subscriptionId: 'some-subscription-id',
      lastChargeDate: new Date('2005-11-22'),
      isBlocked: false,
      billingPeriodEventsCount: 10,
    });

    await fillDatabaseWithMockedData({
      workspace,
      plan,
    });

    MockDate.set(currentDate);

    /**
     * Act
     */
    const worker = new PaymasterWorker();

    await worker.start();
    await worker.handle(WORKSPACE_SUBSCRIPTION_CHECK);
    await worker.finish();

    /**
     * Assert
     */
    const updatedWorkspace = await workspacesCollection.findOne({ _id: workspace._id });

    expect(updatedWorkspace.isBlocked).toEqual(false);
    MockDate.reset();
  });

  test('Should block workspace if it has subscription and after payday passed 3 days', async () => {
    /**
     * Arrange
     */
    const currentDate = new Date('2005-12-26');
    const plan = createPlanMock({
      monthlyCharge: 100,
      isDefault: true,
    });
    const workspace = createWorkspaceMock({
      plan,
      subscriptionId: 'some-subscription-id',
      lastChargeDate: new Date('2005-11-22'),
      isBlocked: false,
      billingPeriodEventsCount: 10,
    });

    await fillDatabaseWithMockedData({
      workspace,
      plan,
    });

    MockDate.set(currentDate);

    /**
     * Act
     */
    const worker = new PaymasterWorker();

    await worker.start();
    await worker.handle(WORKSPACE_SUBSCRIPTION_CHECK);
    await worker.finish();

    /**
     * Assert
     */
    const updatedWorkspace = await workspacesCollection.findOne({ _id: workspace._id });

    expect(updatedWorkspace.isBlocked).toEqual(true);
    MockDate.reset();
  });

  test('Should update lastChargeDate and billingPeriodEventsCount if workspace has free tariff plan and it\'s time to pay', async () => {
    /**
     * Arrange
     */
    const currentDate = new Date('2005-12-22');
    const plan = createPlanMock({
      monthlyCharge: 0,
      isDefault: true,
    });
    const workspace = createWorkspaceMock({
      plan,
      subscriptionId: null,
      lastChargeDate: new Date('2005-11-22'),
      isBlocked: false,
      billingPeriodEventsCount: 10,
    });

    await fillDatabaseWithMockedData({
      workspace,
      plan,
    });

    MockDate.set(currentDate);

    /**
     * Act
     */
    const worker = new PaymasterWorker();

    await worker.start();
    await worker.handle(WORKSPACE_SUBSCRIPTION_CHECK);
    await worker.finish();

    /**
     * Assert
     */
    const updatedWorkspace = await workspacesCollection.findOne({ _id: workspace._id });

    expect(updatedWorkspace.isBlocked).toEqual(false);
    expect(updatedWorkspace.lastChargeDate).toEqual(currentDate);
    expect(updatedWorkspace.billingPeriodEventsCount).toEqual(0);
    MockDate.reset();
  });

  test('Shouldn\'t change workspace if it isn\'t time to pay', async () => {
    /**
     * Arrange
     */
    const currentDate = new Date('2005-12-21');
    const plan = createPlanMock({
      monthlyCharge: 100,
      isDefault: true,
    });
    const workspace = createWorkspaceMock({
      plan,
      subscriptionId: null,
      lastChargeDate: new Date('2005-11-22'),
      isBlocked: false,
      billingPeriodEventsCount: 10,
    });

    await fillDatabaseWithMockedData({
      workspace,
      plan,
    });

    MockDate.set(currentDate);

    /**
     * Act
     */
    const worker = new PaymasterWorker();

    await worker.start();
    await worker.handle(WORKSPACE_SUBSCRIPTION_CHECK);
    await worker.finish();

    /**
     * Assert
     */
    const updatedWorkspace = await workspacesCollection.findOne({ _id: workspace._id });

    expect(updatedWorkspace).toEqual(workspace);
    MockDate.reset();
  });

  test('Shouldn\'t throw error if lastChargeDate of workspace is undefined', async () => {
    /**
     * Arrange
     */
    const currentDate = new Date('2005-12-21');
    const plan = createPlanMock({
      monthlyCharge: 100,
      isDefault: true,
    });
    const workspace = createWorkspaceMock({
      plan,
      subscriptionId: null,
      lastChargeDate: undefined,
      isBlocked: false,
      billingPeriodEventsCount: 10,
    });

    await fillDatabaseWithMockedData({
      workspace,
      plan,
    });

    MockDate.set(currentDate);

    /**
     * Act
     */
    const worker = new PaymasterWorker();

    await worker.start();

    /**
     * Assert
     */
    await expect(worker.handle(WORKSPACE_SUBSCRIPTION_CHECK)).resolves.not.toThrow();
    await worker.finish();
  });

  test('Should send a report with collected data', async () => {
    /**
     * Arrange
     *
     * Worker initialization
     */
    const currentDate = new Date('2005-12-22');
    const plan = createPlanMock({
      monthlyCharge: 0,
      isDefault: true,
    });
    const workspace = createWorkspaceMock({
      plan,
      subscriptionId: null,
      lastChargeDate: new Date('2005-11-22'),
      isBlocked: false,
      billingPeriodEventsCount: 10,
    });

    await fillDatabaseWithMockedData({
      workspace,
      plan,
    });

    MockDate.set(currentDate);
    const worker = new PaymasterWorker();

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
    await worker.handle(WORKSPACE_SUBSCRIPTION_CHECK);
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
    MockDate.reset();
  });
});
