import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import { DatabaseReadWriteError } from '../../../lib/workerErrors';
import * as pkg from '../package.json';
import { Collection } from 'mongodb';
import type { PerformanceRecord, PerformanceDocument, AggregatedTransaction } from './types';

/**
 * Performance worker
 */
export default class PerformanceWorker extends Worker {
  /**
   * Worker type (will pull tasks from Registry queue with the same name)
   */
  public readonly type: string = pkg.workerType;

  /**
   * Database Controller
   */
  private db: DatabaseController = new DatabaseController(process.env.MONGO_EVENTS_DATABASE_URI);

  private readonly dbCollectionName: string = 'performance_transactions';

  /**
   * Collection to save performance data
   */
  private performanceCollection: Collection<PerformanceDocument>;

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.db.connect();
    this.db.createGridFsBucket(this.dbCollectionName);
    this.performanceCollection = this.db.getConnection().collection(this.dbCollectionName);
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
   * @param task - Message object from consume method
   */
  public async handle(task: PerformanceRecord): Promise<void> {
    switch (task.catcherType) {
      case 'performance': await this.savePerformance(task); break;
    }
  }

  /**
   * Save performance data to database
   *
   * @param data - Performance record containing project ID and performance metrics
   *
   * Key operations:
   * 1. Round all numeric values to 3 decimal places to avoid floating point precision issues
   * 2. Add timestamp to each transaction
   * 3. Round values in aggregatedSpans as well
   * 4. Use bulkWrite for efficient database operations
   * 5. Trigger aggregation after saving
   */
  private async savePerformance(data: PerformanceRecord): Promise<void> {
    try {
      const { projectId, payload, catcherType } = data;

      if (catcherType !== 'performance') {
        throw new Error('Invalid catcher type');
      }

      const ROUND_DECIMALS = 3;
      const BASE = 10;
      const transactionsWithTimestamp = payload.transactions.map(transaction => ({
        ...transaction,
        timestamp: payload.timestamp,
        minStartTime: Math.round(transaction.minStartTime * Math.pow(BASE, ROUND_DECIMALS)) / Math.pow(BASE, ROUND_DECIMALS),
        maxEndTime: Math.round(transaction.maxEndTime * Math.pow(BASE, ROUND_DECIMALS)) / Math.pow(BASE, ROUND_DECIMALS),
        maxDuration: Math.round(transaction.maxDuration * Math.pow(BASE, ROUND_DECIMALS)) / Math.pow(BASE, ROUND_DECIMALS),
        p50duration: Math.round(transaction.p50duration * Math.pow(BASE, ROUND_DECIMALS)) / Math.pow(BASE, ROUND_DECIMALS),
        p95duration: Math.round(transaction.p95duration * Math.pow(BASE, ROUND_DECIMALS)) / Math.pow(BASE, ROUND_DECIMALS),
        avgStartTime: Math.round(transaction.avgStartTime * Math.pow(BASE, ROUND_DECIMALS)) / Math.pow(BASE, ROUND_DECIMALS),
        aggregatedSpans: transaction.aggregatedSpans.map(span => ({
          ...span,
          minStartTime: Math.round(span.minStartTime * Math.pow(BASE, ROUND_DECIMALS)) / Math.pow(BASE, ROUND_DECIMALS),
          maxEndTime: Math.round(span.maxEndTime * Math.pow(BASE, ROUND_DECIMALS)) / Math.pow(BASE, ROUND_DECIMALS),
          maxDuration: Math.round(span.maxDuration * Math.pow(BASE, ROUND_DECIMALS)) / Math.pow(BASE, ROUND_DECIMALS),
          p50duration: Math.round(span.p50duration * Math.pow(BASE, ROUND_DECIMALS)) / Math.pow(BASE, ROUND_DECIMALS),
          p95duration: Math.round(span.p95duration * Math.pow(BASE, ROUND_DECIMALS)) / Math.pow(BASE, ROUND_DECIMALS),
        })),
      }));

      const bulkOperations = transactionsWithTimestamp.map(transaction => ({
        updateOne: {
          filter: {
            projectId,
            name: transaction.name,
          },
          update: {
            $push: {
              transactions: transaction,
            },
            $setOnInsert: {
              projectId,
              name: transaction.name,
              createdAt: new Date(),
            },
          },
          upsert: true,
        }
      }));

      await this.performanceCollection.bulkWrite(bulkOperations);
      await this.aggregateTransactions(projectId);
    } catch (err) {
      this.logger.error(`Couldn't save performance data due to: ${err}`);
      throw new DatabaseReadWriteError(err);
    }
  }

  /**
   * Aggregate transactions data for a project
   * 
   * @param projectId - Project ID to aggregate data for
   * 
   * Key operations:
   * 1. Calculate min/max timestamps across all transactions
   * 2. Sort durations array to calculate percentiles
   * 3. Calculate p50 and p95 percentiles from sorted durations
   * 4. Calculate failure rate based on error count
   * 5. Round all numeric values to 3 decimal places
   * 6. Update documents with aggregated data
   */
  private async aggregateTransactions(projectId: string): Promise<void> {
    const PERCENTILE_50 = 0.5;
    const PERCENTILE_95 = 0.95;
    const ROUND_DECIMALS = 3;

    const aggregationPipeline = [
      { $match: { projectId } },
      { $unwind: '$transactions' },
      {
        $group: {
          _id: '$name',
          minStartTime: { $min: '$transactions.minStartTime' },
          maxEndTime: { $max: '$transactions.maxEndTime' },
          durations: { $push: '$transactions.maxDuration' },
          maxDurations: { $push: '$transactions.maxDuration' },
          totalCount: { $sum: 1 },
          errorCount: {
            $sum: {
              $cond: [ { $eq: ['$transactions.status', 'error'] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          name: '$_id',
          minStartTime: {
            $round: [
              { $min: '$minStartTime' },
              ROUND_DECIMALS,
            ]
          },
          maxEndTime: {
            $round: [
              { $max: '$maxEndTime' },
              ROUND_DECIMALS,
            ]
          },
          p50duration: {
            $round: [
              {
                $arrayElemAt: [
                  { $sortArray: { input: '$durations', sortBy: 1 } },
                  { $floor: { $multiply: [ { $size: '$durations' }, PERCENTILE_50] } },
                ]
              },
              ROUND_DECIMALS,
            ]
          },
          p95duration: {
            $round: [
              {
                $arrayElemAt: [
                  { $sortArray: { input: '$durations', sortBy: 1 } },
                  { $floor: { $multiply: [ { $size: '$durations' }, PERCENTILE_95] } },
                ]
              },
              ROUND_DECIMALS,
            ]
          },
          maxDuration: {
            $round: [
              { $max: '$maxDurations' },
              ROUND_DECIMALS,
            ]
          },
          failureRate: {
            $round: [
              { $divide: ['$errorCount', '$totalCount'] },
              ROUND_DECIMALS,
            ]
          },
        },
      },
    ];

    const aggregatedData = await this.performanceCollection.aggregate<AggregatedTransaction>(aggregationPipeline).toArray();

    await this.performanceCollection.updateMany(
      { projectId },
      { $set: { aggregatedData } }
    );
  }
}
