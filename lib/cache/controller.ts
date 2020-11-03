import NodeCache from 'node-cache';

/**
 * @typedef {any} CacheValue — cached data
 */
type CacheValue = any; // eslint-disable-line

/**
 * Controller object for cache engine
 */
export default class CacheController {
  /**
   * Cache provider class
   *
   * @private
   */
  private cache: NodeCache;

  /**
   * Cache key prefix
   */
  private readonly prefix: string;

  /**
   * Create a new cache instance
   *
   * @param {NodeCache} cacheProvider - cache provider (allows to mock in tests)
   */
  constructor({ provider = undefined, prefix = '' }: { provider?: NodeCache; prefix?: string} = {}) {
    this.prefix = prefix || '';

    if (provider) {
      this.cache = provider;
    } else {
      this.cache = new NodeCache({
        stdTTL: 60,
        checkperiod: 30,
        useClones: false,
      });
    }
  }

  /**
   * Save data to cache
   *
   * @param {string} key — cache key
   * @param {CacheValue} value — cached data
   * @param {number} [ttl] — data's time to live in seconds
   */
  public set(key: string, value: CacheValue, ttl?: number): boolean {
    const keyPrefixed = this.getKey(key);

    if (ttl) {
      return this.cache.set(keyPrefixed, value, ttl);
    } else {
      return this.cache.set(keyPrefixed, value);
    }
  }

  /**
   * Get cached value (or resolve and cache if it is necessary)
   *
   * @param {string} key — cache key
   * @param {Function} [resolver] — function for getting value
   * @param {number} [ttl] — data's time to live in seconds
   * @returns {CacheValue} — cached data
   */
  public async get(key: string, resolver?: Function, ttl?: number): Promise<CacheValue> {
    const keyPrefixed = this.getKey(key);

    let value = this.cache.get(keyPrefixed);

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
      if (ttl) {
        this.set(key, value, ttl);
      } else {
        this.set(key, value);
      }
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
    if (Array.isArray(key)) {
      key = key.map(k => this.getKey(k));
    } else {
      key = this.getKey(key);
    }

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

  /**
   * Return key with prefix
   *
   * @param {string} key - cache prefix key
   */
  private getKey(key: string): string {
    if (!this.prefix) {
      return key;
    }

    return this.prefix + ':' + key;
  }
}
