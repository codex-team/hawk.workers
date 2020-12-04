import crypto from 'crypto';

/**
 * Crypto helper
 */
export default class Crypto {
  /**
   * Get hash for target value
   *
   * @param value — data to be hashed
   * @param algo — type of algorithm to be used for hashing
   */
  public static hash(value: unknown, algo = 'sha256'): string {
    const stringifiedValue = JSON.stringify(value);

    return crypto.createHash(algo)
      .update(stringifiedValue)
      .digest('hex');
  }
}
