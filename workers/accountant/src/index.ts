import {DatabaseController} from '../../../lib/db/controller';
import {Worker} from '../../../lib/worker';
import {Collection, ObjectID, UpdateQuery} from 'mongodb';
import {AccountantEvent, EventType, IncomeTransactionPayload, TransactionEvent, TransactionType} from "../types/event";
import * as pkg from '../package.json';

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
  private db: DatabaseController = new DatabaseController();

  private workspaces: Collection;
  private transactions: Collection;
  private plans: Collection;

  constructor(){
    super();
  }

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.db.connect('hawk');

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
   */
  public async handle(event: AccountantEvent): Promise<void> {
    switch (event.type) {
      case EventType.Transaction:
        await this.handleTransactionEvent(event as TransactionEvent);
    }
  }

  /**
   * Transaction event method
   *
   * @param {TransactionEvent} event
   */
  public async handleTransactionEvent(event: TransactionEvent): Promise<void> {
    const { payload } = event;

    let balanceDiff = payload.amount;

    if (payload.type === TransactionType.Charge) {
      const workspace = await this.workspaces.findOne({ _id: new ObjectID(payload.workspaceId) });

      if (workspace.balance < payload.amount) {
        /**
         * @todo Send notification to merchant worker to rebill
         * @todo Send notification to collector to block new events
         */
        console.warn('Not enough money on workspace balance');
        return;
      }

      balanceDiff *= -1;
    }

    const transaction: any = {
      ...payload,
      workspaceId: new ObjectID(payload.workspaceId)
    };

    if ((payload as IncomeTransactionPayload).userId) {
      transaction.userId = new ObjectID((payload as IncomeTransactionPayload).userId);
    }

    await this.transactions.insertOne(transaction);

    const updateData: UpdateQuery<any> = {
      $inc: {balance: balanceDiff}
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
