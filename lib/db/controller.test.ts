import * as mongodb from 'mongodb';
import { DatabaseController } from './controller';
import { DatabaseConnectionError } from '../workerErrors';
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

  describe('initial handshake retry', () => {
    const mongoModule = jest.requireActual('mongodb');
    let connectSpy: jest.SpyInstance;

    beforeEach(() => {
      process.env.MONGO_RECONNECT_TRIES = '5';
      process.env.MONGO_RECONNECT_INTERVAL = '1';
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      connectSpy = jest.spyOn(mongoModule, 'connect');
    });

    afterEach(() => {
      delete process.env.MONGO_RECONNECT_TRIES;
      delete process.env.MONGO_RECONNECT_INTERVAL;
      jest.restoreAllMocks();
    });

    it('retries the initial connection until it succeeds', async () => {
      const fakeDb = {} as mongodb.Db;
      const fakeClient = { db: jest.fn().mockReturnValue(fakeDb) } as unknown as mongodb.MongoClient;

      connectSpy
        .mockRejectedValueOnce(new Error('unreachable'))
        .mockRejectedValueOnce(new Error('unreachable'))
        .mockResolvedValueOnce(fakeClient);

      const controller = new DatabaseController('mongodb://localhost:27017/test');
      const result = await controller.connect();

      expect(connectSpy).toHaveBeenCalledTimes(3);
      expect(result).toBe(fakeDb);
    });

    it('throws DatabaseConnectionError after exhausting all retries', async () => {
      connectSpy.mockRejectedValue(new Error('unreachable'));

      const controller = new DatabaseController('mongodb://localhost:27017/test');

      await expect(controller.connect()).rejects.toBeInstanceOf(DatabaseConnectionError);
      expect(connectSpy).toHaveBeenCalledTimes(5);
    });
  });
});
