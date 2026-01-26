/**
 * Normalize and validate GitHub App private key.
 *
 * @param rawPrivateKey - raw value from env (GITHUB_PRIVATE_KEY)
 * @returns PEM-encoded private key string
 */
export function normalizeGitHubPrivateKey(rawPrivateKey: string): string {
  /**
   * Trim and remove surrounding quotes (dotenv can keep them)
   */
  let privateKey = rawPrivateKey.trim();

  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith('\'') && privateKey.endsWith('\''))
  ) {
    privateKey = privateKey.slice(1, -1);
  }

  /**
   * Support passing base64-encoded private key (common in CI).
   * If it doesn't look like a PEM block but looks like base64, decode it.
   */
  const MIN_BASE64_KEY_LENGTH = 200;

  if (!privateKey.includes('BEGIN') && /^[A-Za-z0-9+/=\s]+$/.test(privateKey) && privateKey.length > MIN_BASE64_KEY_LENGTH) {
    try {
      privateKey = Buffer.from(privateKey, 'base64').toString('utf8');
    } catch {
      /**
       * Keep original value, we'll validate below.
       */
    }
  }

  /**
   * Replace literal "\n" sequences with actual newlines.
   */
  if (privateKey.includes('\\n') && !privateKey.includes('\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  /**
   * Normalize Windows line endings if any.
   */
  privateKey = privateKey.replace(/\r\n/g, '\n');

  /**
   * Basic validation: must be a PEM private key.
   */
  if (!privateKey.includes('-----BEGIN') || !privateKey.includes('PRIVATE KEY-----')) {
    throw new Error(
      'GITHUB_PRIVATE_KEY must be a valid PEM-encoded private key (-----BEGIN ... PRIVATE KEY----- ... -----END ... PRIVATE KEY-----)'
    );
  }

  return privateKey;
}
