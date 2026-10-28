import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import { validateReleases } from './validate-releases';

/**
 * Worker that detects events fixed by a release.
 */
export default class ReleaseValidatorWorker extends Worker {
  /**
   * Worker type.
   */
  public readonly type: string = pkg.workerType;

  /**
   * Events database controller.
   */
  private eventsDb = new DatabaseController(process.env.MONGO_EVENTS_DATABASE_URI);

  /**
   * Connect to the events database and start consuming tasks.
   */
  public async start(): Promise<void> {
    this.logger.info('Connecting to events database');
    await this.eventsDb.connect();
    this.logger.info('Events database connected; starting task consumer');
    await super.start();
    this.logger.info('Ready to consume release validation tasks');
  }

  /**
   * Stop consuming tasks and close the database connection.
   */
  public async finish(): Promise<void> {
    this.logger.info('Stopping release validator');
    await super.finish();
    await this.eventsDb.close();
    this.logger.info('Release validator stopped');
  }

  /**
   * Handle a scheduled release validation task.
   */
  public async handle(): Promise<void> {
    try {
      await validateReleases(this.eventsDb.getConnection());
    } catch (error) {
      this.logger.error('Release validation failed', error);
      throw error;
    }
  }
}
