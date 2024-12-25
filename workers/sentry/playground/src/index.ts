import { DecodedIntegrationToken } from '@hawk.so/types';
import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.HAWK_INTEGRATION_TOKEN) {
  throw new Error('Fill HAWK_INTEGRATION_TOKEN in .env file');
}

/**
 * Decode Hawk integration token
 *
 * @param token - stringified integration token
 */
function decodeIntegrationToken(token: string): DecodedIntegrationToken {
  return JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
}

/**
 * Sentry DSN should follow this:
 * const DSN_REGEX = /^(?:(\w+):)\/\/(?:(\w+)(?::(\w+)?)?@)([\w.-]+)(?::(\d+))?\/(.+)/;
 * https://github.com/getsentry/sentry-javascript/blob/d773cb7324480ed3cffc14504f0e41951e344d19/packages/core/src/utils-hoist/dsn.ts#L7
 *
 * So we can't use our integration token as is.
 * Instead, we will concatinate integrationId and secret and remove hyphens from their uuids.
 */
function getHexIntegrationToken(): string {
  const token = process.env.HAWK_INTEGRATION_TOKEN as string;

  const { integrationId, secret } = decodeIntegrationToken(token);

  const removeHyphens = (str: string): string => str.replace(/-/g, '');

  return `${removeHyphens(integrationId)}${removeHyphens(secret)}`;
}

/**
 * Compose DSN
 */
const dsn = `https://${getHexIntegrationToken()}@k1.hawk.so/0`;

/**
 * Initialize Sentry
 */
Sentry.init({
  dsn,
  debug: true,
});

/**
 * Function that will throw an error
 */
function throwDemoError(): void {
  throw new Error('This is a demo error for Sentry!');
}

/**
 * Main function to run our demo
 */
async function main(): Promise<void> {
  try {
  /**
   * Attempt to run function that throws error
   */
    throwDemoError();
  } catch (error) {
    /**
     * Capture and send error to Sentry
     */
    Sentry.captureException(error);
  }

  /**
   * Allow time for Sentry to send the error before the process exits
   */
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  await Sentry.close(2000);
}

/**
 * Run the demo
 */
main()
  .then(() => {
    console.log('✨ Demo completed');
  })
  .catch(console.error);
