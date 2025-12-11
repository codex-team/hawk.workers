import dotenv from 'dotenv';
import path from 'path';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import { DatabaseController } from '../../../lib/db/controller';
import { Collection } from 'mongodb';
import { PlanDBScheme, WorkspaceDBScheme } from '@hawk.so/types';
import { EventType, PaymasterEvent } from '../types/paymaster-worker-events';
import axios from 'axios';
import * as WorkerNames from '../../../lib/workerNames';
import HawkCatcher from '@hawk.so/nodejs';
import { countDaysBeforePayday, countDaysAfterPayday, countDaysAfterBlock } from '../../../lib/utils/payday';

dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

/**
 * Days after payday to try paying in actual subscription
 * When days after payday is more than this const and we still
 * can not get successful payments then workspace will be blocked.
 */
const DAYS_AFTER_PAYDAY_TO_TRY_PAYING = 3;

/**
 * List of days left number to notify admins about upcoming payment
 */
// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const DAYS_LEFT_ALERT = [3, 2, 1, 0];

/**
 * Days after block to remind admins about blocked workspace
 */
// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const DAYS_AFTER_BLOCK_TO_REMIND = [1, 2, 3, 5, 7, 30];

/**
 * Worker to check workspaces subscription status and ban workspaces without actual subscription
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
   * List of tariff plans
   */
  private plans: PlanDBScheme[];

  /**
   * Check if today is a payday for passed timestamp
   *
   * @param date - last charge date
   * @param paidUntil - paid until date
   * @param isDebug - flag for debug purposes
   */
  private static isTimeToPay(date: Date, paidUntil?: Date, isDebug = false): boolean {
    const expectedPayDay = paidUntil ? new Date(paidUntil) : this.composeBillingPeriodEndDate(date, isDebug);
    const now = new Date();

    return now >= expectedPayDay;
  }

  /**
   * Check if today is a recharge day for passed timestamp
   * It equals to the isTimeToPay in all cases except prePaid workspaces
   *
   * @param date - last charge date
   * @param isDebug - flag for debug purposes
   */
  private static isTimeToRecharge(date: Date, isDebug = false): boolean {
    const nexTimeToRecharge = this.composeBillingPeriodEndDate(date, isDebug);
    const now = new Date();

    return now >= nexTimeToRecharge;
  }

  /**
   * Returns the date - end of the billing period
   *
   * @param date - last charge date
   * @param isDebug - flag for debug workspaces
   */
  private static composeBillingPeriodEndDate(date: Date, isDebug = false): Date {
    const endDate = new Date(date);

    if (isDebug) {
      endDate.setDate(date.getDate() + 1);
    } else {
      endDate.setMonth(date.getMonth() + 1);
    }

    return endDate;
  }

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    const connection = await this.db.connect();

    this.workspaces = connection.collection('workspaces');
    const plansCollection = connection.collection<PlanDBScheme>('plans');

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
      case EventType.WorkspaceSubscriptionCheck:
        await this.handleWorkspaceSubscriptionCheckEvent();
    }
  }

  /**
   * WorkspaceSubscriptionCheckEvent event handler
   *
   * Called periodically, enumerate through workspaces and check if today is a payday for workspace subscription
   */
  private async handleWorkspaceSubscriptionCheckEvent(): Promise<void> {
    const workspaces = await this.workspaces.find({}).toArray();

    await Promise.all(workspaces
      .filter(workspace => {
        /**
         * Skip workspace without lastChargeDate
         */
        if (!workspace.lastChargeDate) {
          const error = new Error('[Paymaster] Workspace without lastChargeDate detected');

          HawkCatcher.send(error, {
            workspaceId: workspace._id.toString(),
          });

          return false;
        }

        return true;
      })
      .map(
        (workspace) => this.processWorkspaceSubscriptionCheck(workspace)
      ));
  }

  /**
   * Checks workspace subscription and block workspaces without actual subscription
   *
   * @param workspace - workspace for checking
   * @private
   */
  private async processWorkspaceSubscriptionCheck(workspace: WorkspaceDBScheme): Promise<[WorkspaceDBScheme, boolean]> {
    const date = new Date();
    const currentPlan = this.plans.find(
      (plan) => plan._id.toString() === workspace.tariffPlanId.toString()
    );

    /** Define readable values */

    /**
     * Is it time to pay
     */
    // @ts-expect-error debug
    const isTimeToPay = PaymasterWorker.isTimeToPay(workspace.lastChargeDate, workspace.paidUntil, workspace.isDebug);

    /**
     * Is it time to recharge workspace limits
     */
    // @ts-expect-error debug
    const isTimeToRecharge = PaymasterWorker.isTimeToRecharge(workspace.lastChargeDate, workspace.isDebug);

    /**
     * How many days left for the expected day of payments
     */
    // @ts-expect-error debug
    const daysLeft = countDaysBeforePayday(workspace.lastChargeDate, workspace.paidUntil, workspace.isDebug);

    /**
     * How many days have passed since the expected day of payments
     */
    // @ts-expect-error debug
    const daysAfterPayday = countDaysAfterPayday(workspace.lastChargeDate, workspace.paidUntil, workspace.isDebug);

    /**
     * How many days have passed since the workspace was blocked
     */
    const daysAfterBlock = countDaysAfterBlock(workspace);

    /**
     * Do we need to ask for money
     */
    const isFreePlan = currentPlan.monthlyCharge === 0;

    /**
     * Today is not payday for workspace
     * Alerting admins to pay for the workspace
     */
    if (!isTimeToPay) {
      /**
       * If it is time to recharge workspace limits, but not time to pay
       * Start new month - recharge billing period events count and update last charge date
       */
      if (isTimeToRecharge) {
        await this.updateLastChargeDate(workspace, date);
        await this.clearBillingPeriodEventsCount(workspace);
      }

      /**
       * If workspace is blocked, but it is not time to pay
       * This case could be reached by prepaid workspaces and manually recharged ones
       */
      if (workspace.isBlocked) {
        await this.unblockWorkspace(workspace);
      }

      /**
       * If payday is coming for the paid plans then notify admins
       */
      if (DAYS_LEFT_ALERT.includes(daysLeft) && !isFreePlan && !workspace.subscriptionId) {
        /**
         * Add task for Sender worker
         */
        await this.addTask(WorkerNames.EMAIL, {
          type: 'days-limit-almost-reached',
          payload: {
            workspaceId: workspace._id.toString(),
            daysLeft: daysLeft,
          },
        });
      }

      /**
       * Do nothing
       */
      return [workspace, false];
    }

    /**
     * If workspace has free plan and it is a time to pay
     * then update last charge date, clear count of events
     * for billing period and unblock the workspace
     */
    if (isFreePlan) {
      await this.updateLastChargeDate(workspace, date);
      await this.clearBillingPeriodEventsCount(workspace);
      await this.unblockWorkspace(workspace);

      return [workspace, false];
    }

    /**
     * Time to pay but workspace has paid plan
     * If it is blocked then remind admins about it
     */
    if (workspace.isBlocked) {
      // Send reminders on certain days after block
      if (daysAfterBlock !== undefined && DAYS_AFTER_BLOCK_TO_REMIND.includes(daysAfterBlock)) {
        await this.sendBlockedWorkspaceReminders(workspace, daysAfterBlock);
      }

      return [workspace, true];
    }

    /**
     * Block workspace if it hasn't subscription from CloudPayments
     */
    if (!workspace.subscriptionId) {
      await this.blockWorkspace(workspace);

      return [workspace, true];
    }

    /**
     * Block workspace if it has paid subscription,
     * but a few days have passed after payday
     */
    if (daysAfterPayday > DAYS_AFTER_PAYDAY_TO_TRY_PAYING) {
      await this.blockWorkspace(workspace);

      return [workspace, true];
    }

    /**
     * Do not block workspace with paid subscription
     * Need to pay but we give admins a few days to pay
     */
    return [workspace, false];
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
   * Set isBlocked=true in workspace
   *
   * @param workspace - workspace for block
   */
  private async blockWorkspace(workspace: WorkspaceDBScheme): Promise<void> {
    await this.addTask(WorkerNames.LIMITER, {
      type: 'block-workspace',
      workspaceId: workspace._id.toString(),
    });

    /**
     * Add task for Sender worker
     */
    await this.addTask(WorkerNames.EMAIL, {
      type: 'block-workspace',
      payload: {
        workspaceId: workspace._id.toString(),
      },
    });

    await this.sendWorkspaceBlockedReport(workspace);
  }

  /**
   * Set isBlocked=false in workspace
   *
   * @param workspace - workspace for block
   */
  private async unblockWorkspace(workspace: WorkspaceDBScheme): Promise<void> {
    await this.addTask(WorkerNames.LIMITER, {
      type: 'unblock-workspace',
      workspaceId: workspace._id.toString(),
    });
  }


  /**
   * Sends reminder emails to blocked workspace admins
   *
   * @param workspace - workspace to send reminders for
   * @param daysAfterBlock - number of days since the workspace was blocked
   */
  private async sendBlockedWorkspaceReminders(
    workspace: WorkspaceDBScheme,
    daysAfterBlock: number
  ): Promise<void> {
    await this.addTask(WorkerNames.EMAIL, {
      type: 'blocked-workspace-reminder',
      payload: {
        workspaceId: workspace._id.toString(),
        daysAfterBlock,
      },
    });
  }

  /**
   * Sets BillingPeriodEventsCount to 0 in workspace
   *
   * @param workspace - workspace for clear counter
   */
  private async clearBillingPeriodEventsCount(workspace: WorkspaceDBScheme): Promise<void> {
    await this.workspaces.updateOne({
      _id: workspace._id,
    }, {
      $set: {
        billingPeriodEventsCount: 0,
      },
    });
  }

  /**
   * Send a notification to the reports chat about banned workspace
   *
   * @param {WorkspaceDBScheme} workspace - workspace to be reported
   * @returns {Promise<void>}
   * @private
   */
  private async sendWorkspaceBlockedReport(workspace: WorkspaceDBScheme): Promise<void> {
    const reportMessage = `
💰 Hawk Paymaster ${process.env.ENVIRONMENT_NAME ? `(${process.env.ENVIRONMENT_NAME})` : ''}

Workspace "${workspace.name}" has been blocked.
    `;

    await this.sendReport(reportMessage);
  }

  /**
   * Sends notify to the chat
   *
   * @param reportData - report notify in HTML markup to send
   */
  private async sendReport(reportData: string): Promise<void> {
    if (!process.env.REPORT_NOTIFY_URL) {
      this.logger.error('Can\'t send report because REPORT_NOTIFY_URL not provided');

      return;
    }

    await axios({
      method: 'post',
      url: process.env.REPORT_NOTIFY_URL,
      data: 'message=' + reportData + '&parse_mode=HTML',
    });
  }
}
