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
    await this.eventsDb.connect();
    await super.start();
  }

  /**
   * Stop consuming tasks and close the database connection.
   */
  public async finish(): Promise<void> {
    await super.finish();
    await this.eventsDb.close();
  }

  /**
   * Handle a scheduled release validation task.
   */
  public async handle(): Promise<void> {
    this.logger.info('Release validation started');

    await validateReleases(this.eventsDb.getConnection());

    this.logger.info('Release validation finished');
  }
}
