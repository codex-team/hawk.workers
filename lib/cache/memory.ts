import NodeCache from 'node-cache';

type CacheValue = any; // eslint-disable-line

// const CACHE_FILE = path.join(__dirname, '..', '..', 'cache', 'store.json');
const CACHE_LIFE = 60;

/**
 * File cache controller
 */
class CacheController {
  /**
   * Cache class
   *
   * @private
   */
  private cache: NodeCache;

  /**
   * Create a new cache
   *
   * @param {} options - Cache class options
   */
  constructor(options) {
    this.cache = new NodeCache(options);
  }

  /**
   * Save
   *
   * @param key
   * @param value
   */
  public set(key: string, value: CacheValue): boolean {
    return this.cache.set(key, value);
  }

  /**
   * Get
   *
   * @param key
   */
  public get(key: string): CacheValue {
    return this.cache.get(key);
  }

  /**
   * Method for getting cached value or resolve and cache one
   *
   * @param {string} key - cache key
   * @param {Function} resolver - function for getting value
   */
  public async getCached(key, resolver: Function): Promise<any> { // eslint-disable-line
    let value = this.get(key);

    if (!value) {
      value = await resolver();

      this.set(key, value);
    //   console.log(`Save to cache. Key ${key}`);
    // } else {
    //   console.log(`Get from cache. Key ${key}`);
    }

    return value;
  }
}

const CacheClass = new CacheController({
  stdTTL: CACHE_LIFE,
  checkperiod: 30,
  useClones: false,
});

export default CacheClass;
