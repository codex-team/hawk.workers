import 'dotenv/config';
import { DatabaseController } from '../../../lib/db/controller';
import createLogger from '../../../lib/logger';
import { validateReleases } from './validate-releases';

const logger = createLogger();

/**
 * Run one release validation pass and close MongoDB before returning.
 *
 * @returns {Promise<void>} completion of the validation and connection cleanup
 */
export async function runReleaseValidation(): Promise<void> {
  logger.info('Release validation started');

  const eventsDb = new DatabaseController(process.env.MONGO_EVENTS_DATABASE_URI);

  try {
    const db = await eventsDb.connect();

    await validateReleases(db);
  } finally {
    await eventsDb.close();
  }

  logger.info('Release validation finished');
}

if (require.main === module) {
  runReleaseValidation().catch(error => {
    logger.error('Release validation failed', error);
    process.exitCode = 1;
  });
}
