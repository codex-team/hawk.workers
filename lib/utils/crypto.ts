import crypto from 'crypto';

/**
 * Crypto helper
 */
export default class Crypto {
  /**
   * Get hash for target value
   *
   * @param {any} value — data to be hashed
   * @param {string} [algo='sha256'] — type of algorithm to be used for hashing
   */
  public static hash(value, algo = 'sha256'): string {
    value = JSON.stringify(value);

    return crypto.createHash(algo)
      .update(value)
      .digest('hex');
  }
}
