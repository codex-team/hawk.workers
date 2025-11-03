import crypto, { BinaryToTextEncoding } from 'crypto';

/**
 * Crypto helper
 */
export default class Crypto {
  /**
   * Get hash for target value
   *
   * @param value — data to be hashed
   * @param algo — type of algorithm to be used for hashing
   * @param digest - type of the representation of the hashed value
   */
  public static hash(value: unknown, algo = 'sha256', digest: BinaryToTextEncoding = 'hex'): string {
    const stringifiedValue = typeof value === 'string' ? value : JSON.stringify(value);

    return crypto.createHash(algo)
      .update(stringifiedValue)
      .digest(digest);
  }
}
