import LRUCache from 'lru-cache';
import Crypto from '../utils/crypto';

/**
 * Pick the strategy of cache key form
 * It could be concatenated list of arguments like 'projectId:eventId'
 * Or it could be hashed json object — blake2b512 algorithn
 */
export type MemoizeKeyStrategy = 'concat' | 'hash';

/**
 * Options of the memoize decorator
 */
export interface MemoizeOptions {
  /**
   * Max number of values stored in LRU cache at the same time
   */
  max?: number;

  /**
   * TTL in milliseconds
   */
  ttl?: number;

  /**
   * Strategy for key generation
   */
  strategy?: MemoizeKeyStrategy;
}

/**
 * Async-only, per-method LRU-backed memoization decorator.
 * Cache persists for the lifetime of the class instance (e.g. worker).
 *
 * @param options
 */
export function memoize(options: MemoizeOptions = {}): MethodDecorator {
  /* eslint-disable @typescript-eslint/no-magic-numbers */
  const {
    max = 50,
    ttl = 1000 * 60 * 30,
    strategy = 'concat',
  } = options;
  /* eslint-enable */

  return function (
    _target,
    propertyKey,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error('@Memoize can only decorate methods');
    }

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      /**
       * Create a cache key for each decorated method
       */
      const cacheKey = `memoizeCache:${String(propertyKey)}`;

      /**
       * Create a new cache if it does not exists yet (for certain function)
       */
      const cache: LRUCache<string, any> = this[cacheKey] ??= new LRUCache<string, any>({
        max,
        ttl,
      });

      const key = strategy === 'hash'
        ? Crypto.hash(args, 'blake2b512', 'base64url')
        : args.map(String).join(':');

      /**
       * Check if we have a cached result
       */
      const cachedResult = cache.get(key);

      if (cachedResult !== undefined) {
        return cachedResult;
      }

      try {
        const result = await originalMethod.apply(this, args);

        cache.set(key, result);

        return result;
      } catch (err) {
        cache.delete(key);
        throw err;
      }
    };

    return descriptor;
  };
}
