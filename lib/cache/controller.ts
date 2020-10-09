import { Cache, ICacheOptions, IRecordOptions } from 'node-file-cache';
import path from 'path';
import fs from 'fs';

type CacheValue = any; // eslint-disable-line

const CACHE_FILE = path.join(__dirname, '..', '..', 'cache', 'store.json');
const CACHE_LIFE = 600;

/**
 * File cache controller
 */
class CacheController {
  /**
   * Cache class
   *
   * @private
   */
  private cache: Cache;

  /**
   * Create a new cache
   *
   * @param {ICacheOptions} options - Cache class options
   */
  constructor(options: ICacheOptions) {
    const cacheDir = path.dirname(options.file);

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir);
    }

    this.cache = new Cache(options);
  }

  /**
   * Save
   *
   * @param {string} key -
   * @param {CacheValue} value -
   * @param {IRecordOptions} options -
   */
  public set(key: string, value: CacheValue, options?: IRecordOptions): Cache {
    return this.cache.set(key, value, options);
  }

  /**
   * Get
   *
   * @param {string} key -
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
  file: CACHE_FILE,
  life: CACHE_LIFE,
});

export default CacheClass;
