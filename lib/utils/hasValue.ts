/**
 * Returns true if specified value is not undefined, null and empty string
 * @param v - value to check
 */
export function hasValue<T>(v: T | undefined | null): v is T {
  return v !== undefined && v !== null && v !== '';
}