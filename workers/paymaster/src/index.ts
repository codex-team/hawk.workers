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
import { EventType, PaymasterEvent, PlanChangedEvent } from '../types/paymaster-worker-events';
import { PlanDBScheme, WorkspaceDBScheme, BusinessOperationDBScheme, BusinessOperationStatus, BusinessOperationType, ConfirmedMemberDBScheme, UserDBScheme } from 'hawk.types';
import dotenv from 'dotenv';
import path from 'path';
import Accounting, { PENNY_MULTIPLIER } from 'codex-accounting-sdk';
import axios from 'axios';

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
   * Collection with all users
   */
  private users: Collection<UserDBScheme>;

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
    this.businessOperations = connection.collection('businessOperations');
    const plansCollection = connection.collection<PlanDBScheme>('plans');

    this.plans = await plansCollection.find({}).toArray();

    if (this.plans.length === 0) {
      throw new Error('Please add tariff plans to the database');
    }

    if (!process.env.ACCOUNTING_API_ENDPOINT) {
      throw new Error('Please specify ACCOUNTING_API_ENDPOINT in .env file');
    }

    /**
     * Initializing accounting SDK
     */
    let tlsVerify;

    /**
     * Checking env variables
     * If at least one path is not transmitted, the variable tlsVerify is undefined
     */
    if (
      ![process.env.TLS_CA_CERT, process.env.TLS_CERT, process.env.TLS_KEY].some(value => value === undefined || value.length === 0)
    ) {
      tlsVerify = {
        tlsCaCertPath: `${process.env.TLS_CA_CERT}`,
        tlsCertPath: `${process.env.TLS_CERT}`,
        tlsKeyPath: `${process.env.TLS_KEY}`,
      };
    }

    this.accounting = new Accounting({
      baseURL: process.env.ACCOUNTING_API_ENDPOINT,
      tlsVerify,
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
        await this.handleWorkspacePlanChargeEvent();

        return;

      case EventType.PlanChanged:
        await this.handlePlanChangedEvent(event as PlanChangedEvent);
    }
  }

  /**
   * WorkspacePlanChargeEvent event handler
   *
   * Called periodically, enumerate through workspaces and check if today is a payday for workspace plan
   */
  private async handleWorkspacePlanChargeEvent(): Promise<void> {
    const workspaces = await this.workspaces.find({}).toArray();

    const result = await Promise.all(workspaces.map(
      (workspace) => this.processWorkspacePlanCharge(workspace)
    ));

    await this.sendReport(result);
  }

  /**
   * Handles charging
   * Returns tuple with workspace data and charged amount
   *
   * @param workspace - workspace to check
   */
  private async processWorkspacePlanCharge(workspace: WorkspaceDBScheme): Promise<[WorkspaceDBScheme, number]> {
    const date = new Date();

    const currentPlan = this.plans.find(
      (plan) => plan._id.toString() === workspace.tariffPlanId.toString()
    );

    /**
     * If today is not pay day or lastChargeDate is today (plan already paid) do nothing or
     * Notify users if balance is low and payment day is coming soon
     * If lastChargeDate is undefined then charge tariff plan and set it
     */
    if (workspace.lastChargeDate && !this.isTimeToPay(workspace.lastChargeDate)) {
      if (this.isTimeToPayComingSoon(workspace)) {
        this.sendLowBalanceNotification(workspace, currentPlan);
      }

      return [workspace, 0]; // no charging
    }

    // todo: Check that workspace did not exceed the limit

    if (currentPlan.monthlyCharge > 0) {
      await this.makeTransactionForPurchasing(workspace, currentPlan.monthlyCharge, date);
    }

    await this.updateLastChargeDate(workspace, date);

    return [workspace, currentPlan.monthlyCharge];
  }

  /**
   * Makes transaction in accounting and returns it
   *
   * @param workspace - workspace for plan purchasing
   * @param planCost - amount of money needed to by plan
   * @param date - date of debiting money
   */
  private async makeTransactionForPurchasing(workspace: WorkspaceDBScheme, planCost: number, date: Date): Promise<void> {
    const purchaseResponse = await this.accounting.purchase({
      accountId: workspace.accountId,
      amount: planCost,
    });

    const transactionId = purchaseResponse.recordId;

    await this.businessOperations.insertOne({
      transactionId: transactionId,
      payload: {
        workspaceId: workspace._id,
        amount: planCost * PENNY_MULTIPLIER,
      },
      status: BusinessOperationStatus.Confirmed,
      type: BusinessOperationType.WorkspacePlanPurchase,
      dtCreated: date,
    });
  }

  /**
   * Update lastChargeDate in workspace
   *
   * @param workspace - workspace for plan purchasing
   * @param date - date of debiting money
   */
  private async updateLastChargeDate(workspace: WorkspaceDBScheme, date: Date): Promise<void> {
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
   * If time to pay is coming
   *
   * @param workspace - workspace data
   */
  private isTimeToPayComingSoon(workspace: WorkspaceDBScheme): boolean {
    const day = 86400000; // 24 * 60 * 60 * 1000
    const minDaysAfterLastChargeToNotify = 26;
    const lastChargeDate = new Date(workspace.lastChargeDate);

    if (lastChargeDate >= new Date(Date.now() - minDaysAfterLastChargeToNotify * day) && lastChargeDate < new Date(Date.now() - (minDaysAfterLastChargeToNotify + 1) * day)) {
      return true;
    }

    return false;
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

  /**
   * Send report with charged workspaces to Telegram
   *
   * @param reportData - data for sending report
   */
  private async sendReport(reportData: [WorkspaceDBScheme, number][]): Promise<void> {
    if (!process.env.REPORT_NOTIFY_URL) {
      this.logger.error('Can\'t send report because REPORT_NOTIFY_URL not provided');

      return;
    }

    reportData = reportData
      .filter(([, chargedAmount]) => chargedAmount > 0)
      .sort(([, a], [, b]) => b - a);

    let report = process.env.SERVER_NAME ? ` Hawk Paymaster (${process.env.SERVER_NAME}) 💰\n` : ' Hawk Paymaster 💰\n';
    let totalChargedAmount = 0;

    reportData.forEach(([workspace, chargedAmount]) => {
      report += `\n${chargedAmount}$ | <b>${encodeURIComponent(workspace.name)}</b> | <code>${workspace._id}</code>`;
      totalChargedAmount += chargedAmount;
    });

    report += `\n\n<b>${totalChargedAmount}$</b> totally charged`;

    await axios({
      method: 'post',
      url: process.env.REPORT_NOTIFY_URL,
      data: 'message=' + report + '&parse_mode=HTML',
    });
  }

  /**
   * Send low balance notification
   *
   * @param workspace - workspace data
   * @param currentPlan - plan of current workspace
   */
  private async sendLowBalanceNotification(workspace: WorkspaceDBScheme, currentPlan: PlanDBScheme): Promise<void> {
    const connection = await this.db.connect();
    const teamCollection = await connection.collection('team:' + workspace._id.toString()).find()
      .toArray();
    const teamAdminCollection: ConfirmedMemberDBScheme[] = teamCollection.filter(user => user?.isAdmin);

    teamAdminCollection.forEach(async (member) => {
      const user = await this.users.findOne({ _id: member.userId });

      if (!user.notifications) {
        return;
      }

      const channels = user.notifications.channels;

      if (channels?.email?.isEnabled) {
        this.addTask(workerNames.EMAIL, {
          type: 'low-balance',
          payload: {
            workspaceId: workspace._id,
            planId: currentPlan._id,
          },
        });
      }
    });
  }
}
