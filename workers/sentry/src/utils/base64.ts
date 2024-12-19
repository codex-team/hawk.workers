/**
 * Decode base64 string
 *
 * @param str - base64 string
 */
export function b64decode(str: string): string {
  return Buffer.from(str, 'base64').toString('binary');
}

/**
 * Encode string to base64
 *
 * @param str - string to encode
 */
export function b64encode(str: string): string {
  return Buffer.from(str).toString('base64');
}
