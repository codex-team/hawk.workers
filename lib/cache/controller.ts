import NodeCache from 'node-cache';

/**
 * @typedef {any} CacheValue — cached data
 */
type CacheValue = any; // eslint-disable-line

/**
 * Controller object for cache engine
 */
class Cache {
  /**
   * Cache class
   *
   * @private
   */
  private cache: NodeCache;

  /**
   * Create a new cache instance
   */
  constructor() {
    /**
     * NodeCache options
     */
    const options = {
      stdTTL: 60,
      checkperiod: 30,
      useClones: false,
    };

    this.cache = new NodeCache(options);
  }

  /**
   * Save data to cache
   *
   * @param {string} key — cache key
   * @param {CacheValue} value — cached data
   */
  public set(key: string, value: CacheValue): boolean {
    return this.cache.set(key, value);
  }

  /**
   * Get cached value (or resolve and cache if it is necessary)
   *
   * @param {string} key — cache key
   * @param {Function} resolver — function for getting value
   * @returns {CacheValue} — cached data
   */
  public async get(key: string, resolver?: Function): Promise<CacheValue> {
    let value = this.cache.get(key);

    /**
     * If value is missing then resolve it and save
     */
    if (!value && resolver) {
      /**
       * Get value from resolver function
       */
      value = await resolver();

      /**
       * Save data
       */
      this.set(key, value);
    }

    return value;
  }

  /**
   * Delete value(-s) by key (or array of keys)
   *
   * @param {string|string[]} key - cache key
   * @returns {number} — number of deleted keys
   */
  public del(key: string|string[]): number {
    return this.cache.del(key);
  }

  /**
   * Flush the whole data
   *
   * @returns {void}
   */
  public flushAll(): void {
    this.cache.flushAll();
  }
}

/**
 * Create a class instance
 */
const CacheManager = new Cache();

export default CacheManager;
