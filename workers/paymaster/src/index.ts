import {
  EventType as AccountantEventType,
  TransactionEvent,
  TransactionType
} from 'hawk-worker-accountant/types/accountant-worker-events';
import { Collection, ObjectID } from 'mongodb';
import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as workerNames from '../../../lib/workerNames';
import * as pkg from '../package.json';
import {
  DailyCheckEvent,
  EventType,
  PaymasterEvent,
  PlanChangedEvent,
  TariffPlan, WorkspacePlan
} from '../types/paymaster-worker-events';

/**
 * Worker to check workspaces balance and handle tariff plan changes
 */
export default class Paymaster extends Worker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public readonly type: string = pkg.workerType;

  /**
   * Database Controller
   */
  private db: DatabaseController = new DatabaseController();

  private workspaces: Collection;
  private plans: Collection;

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.db.connect(process.env.ACCOUNTS_DB_NAME);

    const connection = this.db.getConnection();

    this.workspaces = connection.collection('workspaces');
    this.plans = connection.collection('plans');

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
    const plans = await this.plans.find({}).toArray();

    workspaces.forEach(({ _id, plan }) => {
      const currentPlan: TariffPlan = plans.find((p) => p.name === plan.name);

      /**
       * If today is not pay day or lastChargeDate is today (plan already paid) do nothing
       */
      if (!this.isTodayIsPayDay(plan.lastChargeDate) || this.isToday(plan.lastChargeDate)) {
        return;
      }

      this.sendTransaction(TransactionType.Charge, _id.toString(), currentPlan.monthlyCharge);
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

    const plans: TariffPlan[] = await this.plans.find({}).toArray();
    const workspace = await this.workspaces.findOne({ _id: new ObjectID(payload.workspaceId) });
    const oldPlan: TariffPlan = plans.find((p) => p.name === payload.oldPlan);
    const newPlan: TariffPlan = plans.find((p) => p.name === payload.newPlan);

    const { lastChargeDate } = workspace.plan as WorkspacePlan;

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
   * @param {number} tmstp - last charge date timestamp
   * @returns {boolean}
   */
  private isTodayIsPayDay(tmstp: number): boolean {
    tmstp *= 1000;

    const date = new Date(tmstp);

    const numberOfDays = new Date(date.getFullYear(), date.getMonth(), 0).getDate();
    const expectedPayDay = new Date(tmstp);

    expectedPayDay.setDate(date.getDate() + numberOfDays);

    return this.isToday(expectedPayDay.getTime());
  }

  /**
   * Check if passed timestamp is today
   *
   * @param {number} tmstp - timestamp to check
   * @returns {boolean}
   */
  private isToday(tmstp: number): boolean {
    tmstp *= 1000;

    const now = new Date();
    const date = new Date(tmstp);

    return (
      now.getFullYear() === date.getFullYear() &&
      now.getMonth() === date.getMonth() &&
      now.getDate() === date.getDate()
    );
  }
}
