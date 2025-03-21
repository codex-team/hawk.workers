import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import { DatabaseReadWriteError } from '../../../lib/workerErrors';
import * as pkg from '../package.json';
import { Collection } from 'mongodb';
import type { PerformanceRecord, PerformanceDocument, PerformanceSpansDocument } from './types';

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
  private readonly dbSpansCollectionName: string = 'performance_spans';
  /**
   * Collection to save performance data
   */
  private performanceCollection: Collection<PerformanceDocument>;

  /**
   * Collection to save performance spans
   */
  private performanceSpansCollection: Collection<PerformanceSpansDocument>;

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.db.connect();
    this.db.createGridFsBucket(this.dbCollectionName);
    this.performanceCollection = this.db.getConnection().collection(this.dbCollectionName);
    this.performanceSpansCollection = this.db.getConnection().collection(this.dbSpansCollectionName);
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
   */
  private async savePerformance(data: PerformanceRecord): Promise<void> {
    try {
      const { projectId, payload, catcherType } = data;

      if (catcherType !== 'performance') {
        throw new Error('Invalid catcher type');
      }

      await Promise.all([
        this.performanceCollection.insertOne({
          projectId,
          transactionId: payload.id,
          timestamp: payload.timestamp,
          duration: payload.duration,
          name: payload.name,
          catcherVersion: payload.catcherVersion,
          tags: payload.tags,
        }),
        this.performanceSpansCollection.insertMany(
          payload.spans.map(span => ({
            projectId,
            timestamp: payload.timestamp,
            ...span,
          }))
        ),
      ]);
    } catch (err) {
      this.logger.error(`Couldn't save the release due to: ${err}`);
      throw new DatabaseReadWriteError(err);
    }
  }
}
