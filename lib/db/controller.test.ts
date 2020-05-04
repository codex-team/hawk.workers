import * as mongodb from 'mongodb';
import { DatabaseController } from './controller';
import '../../env-test';

/**
 * Test for the Database Controller module
 */
describe('Database Controller Test', () => {
  const db = new DatabaseController(process.env.MONGO_EVENTS_DATABASE_URI);

  describe('event', () => {
    beforeAll(async () => {
      await db.connect();
    });

    afterAll(async () => {
      await db.close();
    });

    it('should return connection instance', async () => {
      const connection = db.getConnection();
      const result = connection instanceof mongodb.Db;

      expect(result).toBe(true);
    });
  });
});
