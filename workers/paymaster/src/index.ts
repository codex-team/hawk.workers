import dotenv from 'dotenv';
import path from 'path';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import { DatabaseController } from '../../../lib/db/controller';
import { Collection } from 'mongodb';
import { PlanDBScheme, WorkspaceDBScheme } from 'hawk.types';
import { EventType, PaymasterEvent } from '../types/paymaster-worker-events';
import axios from 'axios';
import { HOURS_IN_DAY, MINUTES_IN_HOUR, MS_IN_SEC, SECONDS_IN_MINUTE } from '../../../lib/utils/consts';
import * as WorkerNames from '../../../lib/workerNames';
import HawkCatcher from '@hawk.so/nodejs';

dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

/**
 * Milliseconds in day. Needs for calculating difference between dates in days.
 */
const MILLISECONDS_IN_DAY = HOURS_IN_DAY * MINUTES_IN_HOUR * SECONDS_IN_MINUTE * MS_IN_SEC;

/**
 * Days after payday for paying in actual subscription
 */
const DAYS_AFTER_PAYDAY = -3;

/**
 * Number of days left to notify admins about future payments
 */
const DAYS_LEFT_THRESHOLD = 3;

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
   * Pay day is calculated by formula: last charge date + 30 days
   *
   * @param date - last charge date
   */
  private static isTimeToPay(date: Date): boolean {
    const numberOfDays = 30;
    const expectedPayDay = new Date(date);

    expectedPayDay.setDate(date.getDate() + numberOfDays);

    const now = new Date().getTime();

    return now >= expectedPayDay.getTime();
  }

  /**
   * Returns difference between payday and now in days
   *
   * Pay day is calculated by formula: last charge date + 30 days
   *
   * @param date - last charge date
   */
  private static daysAfterPayday(date: Date): number {
    const numberOfDays = 30;
    const expectedPayDay = new Date(date);

    expectedPayDay.setDate(date.getDate() + numberOfDays);

    const now = new Date().getTime();

    return Math.floor((now - expectedPayDay.getTime()) / MILLISECONDS_IN_DAY);
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

    const result = await Promise.all(workspaces
      .filter(workspace => {
        /**
         * Skip workspace without lastChargeDate
         */
        if (!workspace.lastChargeDate) {
          const error = new Error('[Paymaster] Workspace without lastChargeDate detected');

          HawkCatcher.send(error, {
            workspaceId: workspace._id,
          });

          return false;
        }

        return true;
      })
      .map(
        (workspace) => this.processWorkspaceSubscriptionCheck(workspace)
      ));

    await this.sendReport(result);
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

    /**
     * Define readable values
     */
    const isTimeToPay = PaymasterWorker.isTimeToPay(workspace.lastChargeDate);
    const daysLeft = PaymasterWorker.daysAfterPayday(workspace.lastChargeDate) * -1;
    const isFreePlan = currentPlan.monthlyCharge === 0;

    /**
     * Today is not payday for workspace
     */
    if (!isTimeToPay && !isFreePlan) {
      /**
       * If payday is coming then notify admins
       *
       * @todo do not notify if card is linked?
       */
      if (daysLeft < 3) {
        /**
         * Add task for Sender worker
         */
        await this.addTask(WorkerNames.EMAIL, {
          type: 'days-limit-reached',
          payload: {
            workspaceId: workspace._id,
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
     * If workspace has free plan,
     * Then update last charge date and clear count of events for billing period
     */
    if (isFreePlan) {
      await this.updateLastChargeDate(workspace, date);
      await this.clearBillingPeriodEventsCount(workspace);
      await this.unblockWorkspace(workspace);

      return [workspace, false];
    }

    /**
     * Block workspace if it has subscription,
     * but after payday 3 days have passed
     */
    if (workspace.subscriptionId && daysLeft > DAYS_AFTER_PAYDAY) {
      await this.blockWorkspace(workspace);

      return [workspace, true];
    }

    /**
     * Block workspace if it hasn't subscription
     */
    if (!workspace.subscriptionId) {
      await this.blockWorkspace(workspace);

      return [workspace, true];
    }

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
    await this.workspaces.updateOne({
      _id: workspace._id,
    }, {
      $set: {
        isBlocked: true,
      },
    });

    /**
     * Add task for Sender worker
     */
    await this.addTask(WorkerNames.EMAIL, {
      type: 'block-workspace',
      payload: {
        workspaceId: workspace._id,
      },
    });
  }

  /**
   * Set isBlocked=false in workspace
   *
   * @param workspace - workspace for block
   */
  private async unblockWorkspace(workspace: WorkspaceDBScheme): Promise<void> {
    await this.workspaces.updateOne({
      _id: workspace._id,
    }, {
      $set: {
        isBlocked: false,
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
   * Send report with blocked workspaces to Telegram
   *
   * @param reportData - data for sending report
   */
  private async sendReport(reportData: [WorkspaceDBScheme, boolean][]): Promise<void> {
    if (!process.env.REPORT_NOTIFY_URL) {
      this.logger.error('Can\'t send report because REPORT_NOTIFY_URL not provided');

      return;
    }

    reportData = reportData
      .filter(([, isBlocked]) => isBlocked);

    let report = process.env.SERVER_NAME ? ` Hawk Paymaster (${process.env.SERVER_NAME}) 💰\n` : ' Hawk Paymaster 💰\n';
    let totalBlockedWorkspaces = 0;

    reportData.forEach(([ workspace ]) => {
      report += `\nBlocked ⛔ | <b>${encodeURIComponent(workspace.name)}</b> | <code>${workspace._id}</code>`;
      totalBlockedWorkspaces++;
    });

    report += `\n\n<b>${totalBlockedWorkspaces}</b> totally banned ⛔`;

    await axios({
      method: 'post',
      url: process.env.REPORT_NOTIFY_URL,
      data: 'message=' + report + '&parse_mode=HTML',
    });
  }
}
