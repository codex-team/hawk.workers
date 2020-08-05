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
import { DailyCheckEvent, EventType, PaymasterEvent, PlanChangedEvent } from '../types/paymaster-worker-events';
import TariffPlan from '../../../lib/types/tariffPlan';
import Workspace from '../../../lib/types/workspace';
import { v4 as uuid } from 'uuid';
import {
  BusinessOperationDBScheme,
  BusinessOperationStatus,
  BusinessOperationType
} from '../../../lib/types/businessOperation';

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

  private workspaces: Collection<Workspace>;
  private businessOperations: Collection<BusinessOperationDBScheme>;
  private plans: TariffPlan[];

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    const connection = await this.db.connect();

    this.workspaces = connection.collection('workspaces');
    this.businessOperations = connection.collection('business_operations');
    const plansCollection = connection.collection<TariffPlan>('tariff_plans');

    this.plans = await plansCollection.find({}).toArray();

    if (this.plans.length === 0) {
      throw new Error('Please add tariff plans to the database');
    }

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
      case EventType.DailyCheck:
        await this.handleDailyCheckEvent(event as DailyCheckEvent);

        return;

      case EventType.PlanChanged:
        await this.handlePlanChangedEvent(event as PlanChangedEvent);
    }
  }

  /**
   * DailyCheck event handler
   *
   * Called every day, enumerate through workspaces and check if today is a payday for workspace plan
   *
   * @param {DailyCheckEvent} event - event to handle
   */
  private async handleDailyCheckEvent(event: DailyCheckEvent): Promise<void> {
    const workspaces = await this.workspaces.find({}).toArray();

    await Promise.all(workspaces.map(async (workspace) => {
      const currentPlan = this.plans.find(
        (plan) => plan._id.toString() === workspace.tariffPlanId.toString()
      );

      /**
       * If today is not pay day or lastChargeDate is today (plan already paid) do nothing
       */
      if (this.isToday(workspace.lastChargeDate)) {
        return;
      }
      // todo: Check that workspace did not exceed the limit
      // todo: withdraw the required amount of funds (how to calculate it?)

      const moneyToWriteOff = this.calculateMoneyToWriteOff(currentPlan.monthlyCharge, workspace.lastChargeDate);

      await this.makeTransaction(workspace._id, moneyToWriteOff);
    }));
  }

  /**
   * Makes transaction in accounting and returns it
   *
   * @param workspaceId
   * @param moneyToWriteOff
   */
  private async makeTransaction(workspaceId: ObjectId, moneyToWriteOff: number): Promise<void> {
    const date = new Date();

    await this.businessOperations.insertOne({
      transactionId: uuid(),
      payload: {
        workspaceId: workspaceId,
        amount: moneyToWriteOff,
      },
      status: BusinessOperationStatus.Confirmed,
      type: BusinessOperationType.WorkspacePlanPurchase,
      dtCreated: date,
    });

    await this.workspaces.updateOne({
      _id: workspaceId,
    }, {
      $set: {
        lastChargeDate: date,
      },
    });
  }

  /**
   *
   * @param monthlyCharge
   * @param lastChargeDate
   */
  private calculateMoneyToWriteOff(monthlyCharge: number, lastChargeDate: Date): number {
    return 100;
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
    const oldPlan: TariffPlan = this.plans.find((p) => p.name === payload.oldPlan);
    const newPlan: TariffPlan = this.plans.find((p) => p.name === payload.newPlan);

    const lastChargeDate = workspace.lastChargeDate;

    /**
     * If today is payday and payment has not been proceed, do nothing because daily check event will handle this
     */
    if (this.isTodayIsPayDay(lastChargeDate) && !this.isToday(lastChargeDate)) {
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
  private isTodayIsPayDay(date: Date): boolean {
    const numberOfDays = new Date(date.getFullYear(), date.getMonth(), 0).getDate();
    const expectedPayDay = new Date(date);

    expectedPayDay.setDate(date.getDate() + numberOfDays);

    return this.isToday(expectedPayDay);
  }

  /**
   * Check if passed timestamp is today
   *
   * @param date - date to check
   * @returns {boolean}
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
