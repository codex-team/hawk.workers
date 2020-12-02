import CacheController from './controller';

/**
 * Test for the Database Controller module
 */
describe('Cache Controller Test', () => {
  describe('Try to get value by non-existing key', () => {
    const KEY = 'Hello';
    const cacheManagerInstance = new CacheController();

    it('should return undefined', async () => {
      const EXPECTED_VALUE = await cacheManagerInstance.get(KEY);

      expect(EXPECTED_VALUE).toBe(undefined);
    });
  });

  describe('Try to cache and get data', () => {
    const KEY = 'Hello 2';
    const VALUE = {
      name: 'World',
    };

    const cacheManagerInstance = new CacheController();

    cacheManagerInstance.set(KEY, VALUE);

    it('should return correct data', async () => {
      const EXPECTED_VALUE = await cacheManagerInstance.get(KEY);

      expect(EXPECTED_VALUE).toBe(VALUE);
    });
  });

  describe('Try to get cached data with fallback resolver', () => {
    const KEY = 'Hello 3';
    const VALUE = {
      name: 'World',
    };
    const cacheManagerInstance = new CacheController();

    it('should return undefined for non cached data', async () => {
      const EXPECTED_VALUE = await cacheManagerInstance.get(KEY);

      expect(EXPECTED_VALUE).toBe(undefined);
    });

    it('should cache and return correct data', async () => {
      const EXPECTED_VALUE = await cacheManagerInstance.get(KEY, () => {
        return VALUE;
      });

      expect(EXPECTED_VALUE).toBe(VALUE);
    });
  });

  describe('Try to cache, delete and get data', () => {
    const KEY = 'Hello 4';
    const VALUE = {
      name: 'World',
    };
    const cacheManagerInstance = new CacheController();

    cacheManagerInstance.set(KEY, VALUE);

    it('should return correct data', async () => {
      const EXPECTED_VALUE = await cacheManagerInstance.get(KEY);

      expect(EXPECTED_VALUE).toBe(VALUE);

      cacheManagerInstance.del(KEY);
    });

    it('should return undefined', async () => {
      const EXPECTED_VALUE = await cacheManagerInstance.get(KEY);

      expect(EXPECTED_VALUE).toBe(undefined);
    });
  });
});
