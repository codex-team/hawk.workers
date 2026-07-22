import { rightTrim } from './string';

/**
 * Maximum string length before appending ellipsis
 */
const MAX_STRING_LENGTH = 200;

/**
 * Maximum number of object keys to keep, the rest are reported via META_FIELD
 */
const MAX_OBJECT_KEYS_COUNT = 20;

/**
 * Key added to an object to report how many of its keys were skipped
 */
const META_FIELD = '__meta';

/**
 * Maximum depth of sanitized objects
 */
const MAX_DEPTH = 5;

/**
 * Maximum length of sanitized arrays
 */
const MAX_ARRAY_LENGTH = 10;

/**
 * Checks that the value is a plain object
 *
 * @param target - value to check
 */
function isPlainObject(target: unknown): target is Record<string, unknown> {
  return Object.prototype.toString.call(target) === '[object Object]';
}

/**
 * Values that can be tracked by WeakSet to detect circular references
 */
type ObjectLike = Record<string, unknown> | unknown[];

/**
 * Prepares event data for storing: trims long strings, slices long arrays,
 * cuts off extra object keys and replaces too deep objects and circular
 * references with placeholders.
 */
export class Sanitizer {
  /**
   * Apply sanitizing for array/object/primitives
   *
   * @param data - any value to sanitize
   * @param depth - current depth of recursion
   * @param seen - already visited objects
   */
  public static sanitize(data: unknown, depth = 0, seen = new WeakSet<ObjectLike>()): unknown {
    if (data !== null && typeof data === 'object') {
      if (seen.has(data as ObjectLike)) {
        return '<circular>';
      }
      seen.add(data as ObjectLike);
    }

    if (Array.isArray(data)) {
      return Sanitizer.sanitizeArray(data, depth + 1, seen);
    }

    if (isPlainObject(data)) {
      return Sanitizer.sanitizeObject(data, depth + 1, seen);
    }

    if (typeof data === 'string') {
      return rightTrim(data, MAX_STRING_LENGTH);
    }

    return data;
  }

  /**
   * Slices array to the maximum length and sanitizes each element
   *
   * @param arr - array to sanitize
   * @param depth - current depth of recursion
   * @param seen - already visited objects
   */
  private static sanitizeArray(arr: unknown[], depth: number, seen: WeakSet<ObjectLike>): unknown[] {
    const length = arr.length;

    if (length > MAX_ARRAY_LENGTH) {
      arr = arr.slice(0, MAX_ARRAY_LENGTH);
      arr.push(`<${length - MAX_ARRAY_LENGTH} more items...>`);
    }

    return arr.map((item) => {
      return Sanitizer.sanitize(item, depth, seen);
    });
  }

  /**
   * Sanitizes object values recursively
   *
   * @param data - object to sanitize
   * @param depth - current depth of recursion
   * @param seen - already visited objects
   */
  private static sanitizeObject(
    data: Record<string, unknown>,
    depth: number,
    seen: WeakSet<ObjectLike>
  ): Record<string, unknown> | '<deep object>' {
    if (depth > MAX_DEPTH) {
      return '<deep object>';
    }

    const keys = Object.keys(data);
    const result: Record<string, unknown> = {};

    for (const key of keys.slice(0, MAX_OBJECT_KEYS_COUNT)) {
      result[key] = Sanitizer.sanitize(data[key], depth, seen);
    }

    const skippedKeysCount = keys.length - MAX_OBJECT_KEYS_COUNT;

    if (skippedKeysCount > 0) {
      result[META_FIELD] = `${skippedKeysCount} more key(s) skipped`;
    }

    return result;
  }
}
