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
    monthlyChargeCurrency: 'RUB',
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
  blockedDate?: Date | null;
  paidUntil?: Date;
}): WorkspaceDBScheme => {
  const workspace: WorkspaceDBScheme = {
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
    blockedDate: parameters.blockedDate === undefined ? null : parameters.blockedDate,
  };

  if (parameters.paidUntil) {
    workspace.paidUntil = parameters.paidUntil;
  }

  return workspace;
};

describe('PaymasterWorker', () => {
  let connection: MongoClient;
  let workspacesCollection: Collection<WorkspaceDBScheme>;
  let tariffCollection: Collection<PlanDBScheme>;

  /**
   * Fills database with workspace and plan
   *
   * @param parameters - workspace, project and mocked events amount to be inserted
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
    jest.clearAllMocks();
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
    const blockWorkspaceSpy = jest.spyOn(worker, 'addTask');

    await worker.start();
    await worker.handle(WORKSPACE_SUBSCRIPTION_CHECK);
    await worker.finish();

    /**
     * Assert
     */
    expect(blockWorkspaceSpy).toHaveBeenNthCalledWith(1, 'cron-tasks/limiter', {
      type: 'block-workspace',
      workspaceId: workspace._id.toString(),
    });

    expect(blockWorkspaceSpy).toHaveBeenNthCalledWith(2, 'sender/email', {
      type: 'block-workspace',
      payload: {
        workspaceId: workspace._id.toString(),
      },
    });

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
    const blockWorkspaceSpy = jest.spyOn(worker, 'addTask');

    await worker.start();
    await worker.handle(WORKSPACE_SUBSCRIPTION_CHECK);
    await worker.finish();

    /**
     * Assert
     */

    expect(blockWorkspaceSpy).not.toHaveBeenCalledWith('cron-tasks/limiter', {
      type: 'block-workspace',
      workspaceId: workspace._id.toString(),
    });

    expect(blockWorkspaceSpy).not.toHaveBeenCalledWith('sender/email', {
      type: 'block-workspace',
      payload: {
        workspaceId: workspace._id.toString(),
      },
    });
    MockDate.reset();
  });

  test('Should block workspace if it has subscription and after payday passed 3 days', async () => {
    /**
     * Arrange
     */
    const currentDate = new Date('2005-12-27');
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
    const blockWorkspaceSpy = jest.spyOn(worker, 'addTask');

    await worker.start();
    await worker.handle(WORKSPACE_SUBSCRIPTION_CHECK);
    await worker.finish();

    /**
     * Assert
     */

    expect(blockWorkspaceSpy).toHaveBeenNthCalledWith(1, 'cron-tasks/limiter', {
      type: 'block-workspace',
      workspaceId: workspace._id.toString(),
    });
    expect(blockWorkspaceSpy).toHaveBeenNthCalledWith(2, 'sender/email', {
      type: 'block-workspace',
      payload: {
        workspaceId: workspace._id.toString(),
      },
    });
    MockDate.reset();
  });

  /**
   * Helper function to run blocked workspace reminder test
   *
   * @param lastChargeDate - date of last charge
   * @param blockedDate - date when workspace was blocked
   * @param currentDate - current date to test
   * @param shouldBeCalled - whether the reminder should be called
   * @param expectedDaysAfterBlock - expected days after block in the call
   */
  const testBlockedWorkspaceReminder = async (
    lastChargeDate: Date,
    blockedDate: Date,
    currentDate: Date,
    shouldBeCalled: boolean,
    expectedDaysAfterBlock?: number
  ): Promise<jest.SpyInstance> => {
    const plan = createPlanMock({
      monthlyCharge: 100,
      isDefault: true,
    });
    const workspace = createWorkspaceMock({
      plan,
      billingPeriodEventsCount: 10,
      // any date is good. lets say 14 days before blocked date
      lastChargeDate: new Date(blockedDate.getTime() - 31 * 24 * 60 * 60 * 1000),
      subscriptionId: 'some-subscription-id',
      isBlocked: true,
      blockedDate,
    });

    await fillDatabaseWithMockedData({
      workspace,
      plan,
    });

    MockDate.set(currentDate);

    const worker = new PaymasterWorker();
    const addTaskSpy = jest.spyOn(worker, 'addTask');

    await worker.start();
    await worker.handle(WORKSPACE_SUBSCRIPTION_CHECK);
    await worker.finish();

    if (shouldBeCalled) {
      expect(addTaskSpy).toHaveBeenCalledWith('sender/email', {
        type: 'blocked-workspace-reminder',
        payload: {
          workspaceId: workspace._id.toString(),
          daysAfterBlock: expectedDaysAfterBlock,
        },
      });
    } else {
      expect(addTaskSpy).not.toHaveBeenCalledWith('sender/email', expect.objectContaining({
        type: 'blocked-workspace-reminder',
      }));
    }

    MockDate.reset();
    return addTaskSpy;
  };

  describe('Blocked workspace reminder tests', () => {
    test('Should remind admins for blocked workspace if it has subscription and after block passed 1 day', async () => {
      await testBlockedWorkspaceReminder(
        new Date('2004-12-31'),
        new Date('2005-01-31'),
        new Date('2005-02-01'),
        true,
        1
      );
    });

    test('Should remind admins for blocked workspace if it has subscription and after block passed 5 days', async () => {
      await testBlockedWorkspaceReminder(
        new Date('2004-12-31'),
        new Date('2005-01-31'),
        new Date('2005-02-05'),
        true,
        5
      );
    });

    test('Should remind admins for blocked workspace if it has subscription and after block passed 30 days', async () => {
      await testBlockedWorkspaceReminder(
        new Date('2004-12-31'),
        new Date('2005-01-31'),
        new Date('2005-03-02'),
        true,
        30
      );
    });

    test('Should not remind admins for blocked workspace on days not in reminder schedule (day 4)', async () => {
      await testBlockedWorkspaceReminder(
        new Date('2004-12-31'),
        new Date('2005-01-31'),
        new Date('2005-02-04'),
        false
      );
    });
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
      monthlyCharge: 10,
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

  test('Should not send notification if paidUntil is set to the several months in the future', async () => {
    /**
     * Arrange
     */
    const currentDate = new Date();
    const paidUntil = new Date(currentDate.getTime());

    paidUntil.setMonth(paidUntil.getMonth() + 3);

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
      paidUntil,
    });

    const addTaskSpy = jest.spyOn(PaymasterWorker.prototype, 'addTask');

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
    expect(addTaskSpy).not.toHaveBeenCalled();
    MockDate.reset();
  });

  test('Should send notification if payday is coming for workspace with paidUntil value', async () => {
    /**
     * Arrange
     */
    const currentDate = new Date();
    const paidUntil = new Date(currentDate.getTime());

    paidUntil.setDate(paidUntil.getDate() + 1);

    const plan = createPlanMock({
      monthlyCharge: 1,
      isDefault: true,
    });
    const workspace = createWorkspaceMock({
      plan,
      subscriptionId: null,
      lastChargeDate: new Date('2005-11-22'),
      isBlocked: false,
      billingPeriodEventsCount: 10,
      paidUntil,
    });

    await fillDatabaseWithMockedData({
      workspace,
      plan,
    });

    const addTaskSpy = jest.spyOn(PaymasterWorker.prototype, 'addTask');

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
    expect(addTaskSpy).toHaveBeenCalledWith(
      'sender/email',
      {
        type: 'days-limit-almost-reached',
        payload: {
          workspaceId: workspace._id.toString(),
          daysLeft: 1,
        },
      }
    );

    MockDate.reset();
  });

  test('Should recharge workspace billing period when month passes since last charge date and paidUntil is set to several months in the future', async () => {
    /**
     * Arrange
     */
    const currentDate = new Date();
    const lastChargeDate = new Date(currentDate.getTime());

    lastChargeDate.setMonth(lastChargeDate.getMonth() - 1); // Set last charge date to 1 month ago

    const paidUntil = new Date(currentDate.getTime());

    paidUntil.setMonth(paidUntil.getMonth() + 3); // Set paidUntil to 3 months in the future

    const plan = createPlanMock({
      monthlyCharge: 100,
      isDefault: true,
    });
    const workspace = createWorkspaceMock({
      plan,
      subscriptionId: null,
      lastChargeDate,
      isBlocked: false,
      billingPeriodEventsCount: 10,
      paidUntil,
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

    expect(updatedWorkspace.lastChargeDate).toEqual(currentDate);
    expect(updatedWorkspace.billingPeriodEventsCount).toEqual(0);

    MockDate.reset();
  });

  afterAll(async () => {
    await connection.close();
    MockDate.reset();
  });
});
