import CacheManager from './controller';

/**
 * Test for the Database Controller module
 */
describe('Cache Controller Test', () => {
  afterAll(async () => {
    CacheManager.flushAll();
  });

  describe('Try to get value by non-existing key', () => {
    const KEY = 'Hello';

    it('should return undefined', () => {
      const EXPECTED_VALUE = CacheManager.get(KEY);

      expect(EXPECTED_VALUE).toBe(undefined);
    });
  });

  describe('Try to cache and get data', () => {
    const KEY = 'Hello 2';
    const VALUE = {
      name: 'World',
    };

    CacheManager.set(KEY, VALUE);

    it('should return correct data', () => {
      const EXPECTED_VALUE = CacheManager.get(KEY);

      expect(EXPECTED_VALUE).toBe(VALUE);
    });
  });

  describe('Try to get cached data', () => {
    const KEY = 'Hello 3';
    const VALUE = {
      name: 'World',
    };

    it('should return undefined for non cached data', () => {
      const EXPECTED_VALUE = CacheManager.get(KEY);

      expect(EXPECTED_VALUE).toBe(undefined);
    });

    it('should cache and return correct data', async () => {
      const EXPECTED_VALUE = await CacheManager.getCached(KEY, () => {
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

    CacheManager.set(KEY, VALUE);

    it('should return correct data', () => {
      const EXPECTED_VALUE = CacheManager.get(KEY);

      expect(EXPECTED_VALUE).toBe(VALUE);

      CacheManager.del(KEY);
    });

    it('should return undefined', () => {
      const EXPECTED_VALUE = CacheManager.get(KEY);

      expect(EXPECTED_VALUE).toBe(undefined);
    });
  });
});
