import NodeCache from 'node-cache';

/**
 * @typedef {any} CacheValue
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
   * Get data from cache
   *
   * @param {string} key — cache key
   * @returns {CacheValue} — cached data
   */
  public get(key: string): CacheValue {
    return this.cache.get(key);
  }

  /**
   * Delete value(-s) by key (or array of keys)
   *
   * @param {string|string[]} key
   * @returns {number} — number of deleted keys
   */
  public del(key: string|string[]): number {
    return this.cache.del(key);
  }

  /**
   * Method for getting cached value (or resolve and cache if it is necessary)
   *
   * @param {string} key - cache key
   * @param {Function} resolver - function for getting value
   */
  public async getCached(key, resolver: Function): Promise<any> { // eslint-disable-line
    let value = this.get(key);

    /**
     * If value is missing then resolve it and save
     */
    if (!value) {
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
