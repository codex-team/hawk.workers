import { DatabaseController } from './controller';
import * as mongodb from 'mongodb';
require('../../env');

/**
 * Test for the Database Controller module
 */
describe('Database Contoroller Test', () => {
  const db = new DatabaseController();

  describe('event', () => {
    beforeAll(async () => {
      await db.connect(process.env.EVENTS_DB_NAME);
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
