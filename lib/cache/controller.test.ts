import NodeCache from 'node-cache';
import CacheController from './controller';

jest.mock('node-cache');

describe('Cache Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('set()', () => {
    it('should use prefix if passed', () => {
      const cacheKey = 'key';
      const cacheValue = 'value';
      const prefix = 'prefix';

      const cacheProvider = new NodeCache();
      const cacheController = new CacheController({
        provider: cacheProvider,
        prefix,
      });

      cacheController.set(cacheKey, cacheValue);

      expect(cacheProvider.set).toHaveBeenCalledWith(`${prefix}:${cacheKey}`, cacheValue);
    });

    it('should not use ttl if ttl is not passed', () => {
      const cacheKey = 'key';
      const cacheValue = 'value';

      const cacheProvider = new NodeCache();
      const cacheController = new CacheController({ provider: cacheProvider });

      cacheController.set(cacheKey, cacheValue);

      expect(cacheProvider.set).toHaveBeenCalledWith(cacheKey, cacheValue);
    });

    it('should use ttl if passed', () => {
      const cacheKey = 'key';
      const cacheValue = 'value';
      const ttl = 10000;

      const cacheProvider = new NodeCache();
      const cacheController = new CacheController({ provider: cacheProvider });

      cacheController.set(cacheKey, cacheValue, ttl);

      expect(cacheProvider.set).toHaveBeenCalledWith(cacheKey, cacheValue, ttl);
    });
  });

  describe('get()', () => {
    it('should call provider\'s get', () => {
      const cacheKey = 'key';

      const cacheProvider = new NodeCache();
      const cacheController = new CacheController({ provider: cacheProvider });

      cacheController.get(cacheKey);

      expect(cacheProvider.get).toHaveBeenCalledWith(cacheKey);
    });

    it('should call provider\'s get() with prefix if passed', () => {
      const cacheKey = 'key';
      const prefix = 'prefix';

      const cacheProvider = new NodeCache();
      const cacheController = new CacheController({
        provider: cacheProvider,
        prefix,
      });

      cacheController.get(cacheKey);

      expect(cacheProvider.get).toHaveBeenCalledWith(`${prefix}:${cacheKey}`);
    });

    it('should call the resolver if cache is empty', () => {
      const cacheKey = 'key';

      const cacheProvider = new NodeCache();
      const cacheController = new CacheController({ provider: cacheProvider });
      const resolver = jest.fn();

      // .get() will return undefined
      (cacheProvider.get as jest.Mock).mockImplementation(() => undefined);

      cacheController.get(cacheKey, resolver);

      expect(resolver).toHaveBeenCalled();
    });

    it('should not call the resolver if cache is not empty', () => {
      const cacheKey = 'key';

      const cacheProvider = new NodeCache();
      const cacheController = new CacheController({ provider: cacheProvider });
      const resolver = jest.fn();

      // .get() will return a value
      (cacheProvider.get as jest.Mock).mockImplementation(() => 'some cached value');

      cacheController.get(cacheKey, resolver);

      expect(resolver).toHaveBeenCalledTimes(0);
    });

    it('should call .set() with the resolved value', async () => {
      const cacheKey = 'key';

      const cacheProvider = new NodeCache();
      const cacheController = new CacheController({ provider: cacheProvider });
      const resolvedValue = 'resolved value';
      const resolver = jest.fn(() => resolvedValue);

      // .get() will return undefined
      (cacheProvider.get as jest.Mock).mockImplementation(() => undefined);

      /**
       * Without ttl
       */
      await cacheController.get(cacheKey, resolver);

      expect(resolver).toHaveBeenCalled();
      expect(cacheProvider.set).toHaveBeenCalledWith(cacheKey, resolvedValue);

      /**
       * And with ttl
       */
      const ttl = 10000;

      await cacheController.get(cacheKey, resolver, ttl);

      expect(resolver).toHaveBeenCalled();
      expect(cacheProvider.set).toHaveBeenCalledWith(cacheKey, resolvedValue, ttl); 
    });

    it('should call .set() without prefix, because it is internal call', async () => {
      const cacheKey = 'key';
      const prefix = 'prefix';

      const cacheProvider = new NodeCache();
      const cacheController = new CacheController({
        provider: cacheProvider,
        prefix,
      });
      const resolvedValue = 'resolved value';
      const resolver = jest.fn(() => resolvedValue);
      const internalSet = jest.spyOn(cacheController, 'set');

      // .get() will return undefined
      (cacheProvider.get as jest.Mock).mockImplementation(() => undefined);

      await cacheController.get(cacheKey, resolver);

      expect(resolver).toHaveBeenCalled();

      /**
       * Internal controller's .set() should be called without prefix
       */
      expect(internalSet).toHaveBeenCalledWith(cacheKey, resolvedValue);

      /**
       * Provider's .set() should be called with prefix
       */
      expect(cacheProvider.set).toHaveBeenCalledWith(`${prefix}:${cacheKey}`, resolvedValue);
    });
  });

  describe('del()', () => {
    it('should call provider\'s del()', () => {
      const cacheKey = 'key';

      const cacheProvider = new NodeCache();
      const cacheController = new CacheController({ provider: cacheProvider });

      cacheController.del(cacheKey);

      expect(cacheProvider.del).toHaveBeenCalledWith(cacheKey);
    });

    it('should call provider\'s del() with prefix', () => {
      const cacheKey = 'key';
      const prefix = 'prefix';

      const cacheProvider = new NodeCache();
      const cacheController = new CacheController({
        provider: cacheProvider,
        prefix,
      });

      cacheController.del(cacheKey);

      expect(cacheProvider.del).toHaveBeenCalledWith(`${prefix}:${cacheKey}`);
    });

    it('should call provider\'s del() with prefix (array of keys)', () => {
      const cacheKey1 = 'key1';
      const cacheKey2 = 'key2';
      const prefix = 'prefix';

      const cacheProvider = new NodeCache();
      const cacheController = new CacheController({
        provider: cacheProvider,
        prefix,
      });

      cacheController.del([cacheKey1, cacheKey2]);

      expect(cacheProvider.del).toHaveBeenCalledWith([`${prefix}:${cacheKey1}`, `${prefix}:${cacheKey2}`]);
    });
  });

  describe('flushAll()', () => {
    it('should call provider\'s flushAll()', () => {
      const cacheProvider = new NodeCache();
      const cacheController = new CacheController({ provider: cacheProvider });

      cacheController.flushAll();

      expect(cacheProvider.flushAll).toHaveBeenCalled();
    });
  });
});
