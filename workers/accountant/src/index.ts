import { Collection, ObjectID, UpdateQuery } from 'mongodb';
import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import { AccountantEvent, EventType, IncomeTransactionPayload, TransactionEvent, TransactionType } from '../types/accountant-worker-events';

/**
 * Worker for managing workspaces balance
 */
export default class AccountantWorker extends Worker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public readonly type: string = pkg.workerType;

  /**
   * Database Controller
   */
  private db: DatabaseController = new DatabaseController(process.env.MONGO_ACCOUNTS_DATABASE_URI);

  /**
   * Workspaces collection
   */
  private workspaces: Collection;

  /**
   * Transactions collection
   */
  private transactions: Collection;

  /**
   * Tariff plans collection
   */
  private plans: Collection;

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.db.connect();

    const connection = this.db.getConnection();

    this.workspaces = connection.collection('workspaces');
    this.transactions = connection.collection('transactions');
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
   * @param event
   */
  public async handle(event: AccountantEvent): Promise<void> {
    switch (event.type) {
      case EventType.Transaction:
        await this.handleTransactionEvent(event as TransactionEvent);
    }
  }

  /**
   * Transaction event handler method
   *
   * Write transaction to the database and update workspace balance
   *
   * @param {TransactionEvent} event
   */
  public async handleTransactionEvent(event: TransactionEvent): Promise<void> {
    const { payload } = event;

    let balanceDiff = payload.amount;

    if (payload.type === TransactionType.Charge) {
      const workspace = await this.workspaces.findOne({ _id: new ObjectID(payload.workspaceId) });

      /**
       * If balance is too low for charge:
       * 1. Try to rebill
       * 2. Send notification to collector worker to block new events
       * 3. Send notification to user
       */
      if (workspace.balance < payload.amount) {
        /**
         * @todo Send notification to merchant worker to rebill
         * @todo Send notification to collector to block new events
         * @todo Send notification to user via notify checker worker
         */
        console.warn('Not enough money on workspace balance');

        return;
      }

      balanceDiff *= -1;
    }

    const transaction: any = {
      ...payload,
      workspaceId: new ObjectID(payload.workspaceId),
    };

    if ((payload as IncomeTransactionPayload).userId) {
      transaction.userId = new ObjectID((payload as IncomeTransactionPayload).userId);
    }

    await this.transactions.insertOne(transaction);

    const updateData: UpdateQuery<any> = {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      $inc: { balance: balanceDiff },
    };

    if (payload.type === TransactionType.Charge) {
      updateData.$set = { 'plan.lastChargeDate': payload.date };
    }

    await this.workspaces.updateOne(
      { _id: new ObjectID(payload.workspaceId) },
      updateData
    );
  }
}
