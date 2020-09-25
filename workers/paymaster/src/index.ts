import {
  EventType as AccountantEventType,
  TransactionEvent,
  TransactionType
} from 'hawk-worker-accountant/types/accountant-worker-events';
import { Collection, ObjectId } from 'mongodb';
import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as workerNames from '../../../lib/workerNames';
import * as pkg from '../package.json';
import { WorkspacePlanChargeEvent, EventType, PaymasterEvent, PlanChangedEvent } from '../types/paymaster-worker-events';
import { PlanDBScheme, WorkspaceDBScheme, BusinessOperationDBScheme, BusinessOperationStatus, BusinessOperationType } from 'hawk.types';
import dotenv from 'dotenv';
import path from 'path';
import Accounting from 'codex-accounting-sdk';

dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

/**
 * Worker to check workspaces balance and handle tariff plan changes
 */
export default class PaymasterWorker extends Worker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public readonly type: string = pkg.workerType;

  /**
   * Database Controller
   */
  private db: DatabaseController = new DatabaseController(process.env.MONGO_ACCOUNTS_DATABASE_URI);

  /**
   * Collection with workspaces
   */
  private workspaces: Collection<WorkspaceDBScheme>;

  /**
   * Collection with businessOperations
   */
  private businessOperations: Collection<BusinessOperationDBScheme>;

  /**
   * List of tariff plans
   */
  private plans: PlanDBScheme[];

  /**
   * Accounting SDK
   */
  private accounting: Accounting;

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    const connection = await this.db.connect();

    this.workspaces = connection.collection('workspaces');
    this.businessOperations = connection.collection('business_operations');
    const plansCollection = connection.collection<PlanDBScheme>('tariff_plans');

    this.plans = await plansCollection.find({}).toArray();

    if (this.plans.length === 0) {
      throw new Error('Please add tariff plans to the database');
    }

    if (!process.env.ACCOUNTING_API_ENDPOINT) {
      throw new Error('Please specify ACCOUNTING_API_ENDPOINT in .env file');
    }

    this.accounting = new Accounting({
      baseURL: process.env.ACCOUNTING_API_ENDPOINT,
      tlsVerify: {
        tlsCaCertPath: `${process.env.TLS_CA_CERT}`,
        tlsCertPath: `${process.env.TLS_CERT}`,
        tlsKeyPath: `${process.env.TLS_KEY}`,
      },
    });

    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    await super.finish();
    await this.db.close();
  }

  /**
   * Message handle function
   *
   * @param event - event to handle
   */
  public async handle(event: PaymasterEvent): Promise<void> {
    switch (event.type) {
      case EventType.WorkspacePlanCharge:
        await this.handleWorkspacePlanChargeEvent(event as WorkspacePlanChargeEvent);

        return;

      case EventType.PlanChanged:
        await this.handlePlanChangedEvent(event as PlanChangedEvent);
    }
  }

  /**
   * WorkspacePlanChargeEvent event handler
   *
   * Called periodically, enumerate through workspaces and check if today is a payday for workspace plan
   *
   * @param {WorkspacePlanChargeEvent} event - event to handle
   */
  private async handleWorkspacePlanChargeEvent(event: WorkspacePlanChargeEvent): Promise<void> {
    const workspaces = await this.workspaces.find({}).toArray();

    try {
      await Promise.all(workspaces.map((workspace) => this.processWorkspacePlanCharge(workspace)));
    } catch (e) {
      this.logger.error(e);
    }
  }

  /**
   * Handles charging
   *
   * @param workspace - workspace to check
   */
  private async processWorkspacePlanCharge(workspace: WorkspaceDBScheme): Promise<void> {
    const currentPlan = this.plans.find(
      (plan) => plan._id.toString() === workspace.tariffPlanId.toString()
    );

    /**
     * If today is not pay day or lastChargeDate is today (plan already paid) do nothing
     */
    if (!this.isTimeToPay(workspace.lastChargeDate)) {
      return;
    }
    // todo: Check that workspace did not exceed the limit
    // todo: withdraw the required amount of funds (how to calculate it?)

    await this.makeTransactionForPurchasing(workspace, currentPlan.monthlyCharge);
  }

  /**
   * Makes transaction in accounting and returns it
   *
   * @param workspace - workspace for plan purchasing
   * @param planCost - amount of money needed to by plan
   */
  private async makeTransactionForPurchasing(workspace: WorkspaceDBScheme, planCost: number): Promise<void> {
    const date = new Date();
    const purchaseResponse = await this.accounting.purchase({
      accountId: workspace.accountId,
      amount: planCost,
    });
    const transactionId = purchaseResponse.recordId;

    await this.businessOperations.insertOne({
      transactionId: transactionId,
      payload: {
        workspaceId: workspace._id,
        amount: planCost,
      },
      status: BusinessOperationStatus.Confirmed,
      type: BusinessOperationType.WorkspacePlanPurchase,
      dtCreated: date,
    });

    await this.workspaces.updateOne({
      _id: workspace._id,
    }, {
      $set: {
        lastChargeDate: date,
      },
    });
  }

  /**
   * PlanChanged event handler
   *
   * Called when user changes tariff plan for workspace:
   *
   * If new plan charge is more than old one, withdraw the difference.
   *
   * If today is payday and payment has not been proceed or if new plan charge less then old one, do nothing
   *
   * @param {PlanChangedEvent} event - event to handle
   */
  private async handlePlanChangedEvent(event: PlanChangedEvent): Promise<void> {
    const { payload } = event;

    const workspace = await this.workspaces.findOne({ _id: new ObjectId(payload.workspaceId) });
    const oldPlan: PlanDBScheme = this.plans.find((p) => p.name === payload.oldPlan);
    const newPlan: PlanDBScheme = this.plans.find((p) => p.name === payload.newPlan);

    const lastChargeDate = workspace.lastChargeDate;

    /**
     * If today is payday and payment has not been proceed, do nothing
     */
    if (this.isTimeToPay(lastChargeDate) && !this.isToday(lastChargeDate)) {
      return;
    }

    /**
     * If new plan charge is more than old one, withdraw the difference.
     */
    if (newPlan.monthlyCharge > oldPlan.monthlyCharge) {
      this.sendTransaction(
        TransactionType.Charge,
        workspace._id.toString(),
        newPlan.monthlyCharge - oldPlan.monthlyCharge
      );
    }
  }

  /**
   * Sends transactions to Accountant worker
   *
   * @param {TransactionType} type - type of transaction ('income' or 'charge')
   * @param {string} workspaceId - id of workspace for which transaction has been made
   * @param {number} amount - transaction amount
   */
  private sendTransaction(type: TransactionType, workspaceId: string, amount: number): void {
    this.addTask(workerNames.ACCOUNTANT, {
      type: AccountantEventType.Transaction,
      payload: {
        type,
        date: (new Date()).getTime(),
        workspaceId,
        amount,
      },
    } as TransactionEvent);
  }

  /**
   * Check if today is a pay day for passed timestamp
   *
   * Pay day is calculated by formula: last charge date + number of days in last charged month
   *
   * @param date - last charge date
   */
  private isTimeToPay(date: Date): boolean {
    const numberOfDays = new Date(date.getFullYear(), date.getMonth(), 0).getDate();
    const expectedPayDay = new Date(date);

    expectedPayDay.setDate(date.getDate() + numberOfDays - 1);

    const now = new Date().getTime();

    return now >= expectedPayDay.getTime();
  }

  /**
   * Check if passed timestamp is today
   *
   * @param date - date to check
   */
  private isToday(date: Date): boolean {
    const now = new Date();

    return (
      now.getFullYear() === date.getFullYear() &&
      now.getMonth() === date.getMonth() &&
      now.getDate() === date.getDate()
    );
  }
}
