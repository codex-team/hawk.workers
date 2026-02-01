import '../../../env-test';
import type { EventAddons, EventData, Json } from '@hawk.so/types';
import DataFilter from '../src/data-filter';
jest.mock('amqplib');

/**
 * This file will contain tests for sensitive data filtering
 */

/**
 * Generates task for testing
 *
 * @param {{context, addons}} options - factory options
 * @param [options.context] - generated event context
 * @param [options.addons] - generated event addons
 */
function generateEvent({ context, addons }: {context?: Json, addons?: EventAddons}): EventData<EventAddons> {
  return {
    title: 'Event with sensitive data',
    backtrace: [],
    ...(context && {
      context,
    }),
    ...(addons && {
      addons,
    }),
  };
}

/**
 * Example of object with sensitive information
 */
const sensitiveDataMock = {
  pan: '5500 0000 0000 0004',
  secret: 'D6A03F5C2E0E356F262D56F44370E1CD813583B2',
  credentials: '70BA33708CBFB103F1A8E34AFEF333BA7DC021022B2D9AAA583AABB8058D8D67',
  'card[number]': '5500 0000 0000 0004',
  password: 'bFb7PBm6nZ7RJRq9',
  oldpassword: 'oldSecret123',
  newpassword: 'newSecret456',
  'old-password': 'oldSecretHyphen',
  old_password: 'oldSecretUnderscore',
  'new-password': 'newSecretHyphen',
  new_password: 'newSecretUnderscore',
  auth: 'C4CA4238A0B923820DCC509A6F75849B',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  access_token: '70BA33708CBFB103F1A8E34AFEF333BA7DC021022B2D9AAA583AABB8058D8D67',
  accessToken: '70BA33708CBFB103F1A8E34AFEF333BA7DC021022B2D9AAA583AABB8058D8D67',
};

/**
 * Additional sensitive keys (newly added / previously uncovered)
 */
const additionalSensitiveDataMock = {
  authorization: 'Bearer abc123',
  token: 'token-value',
  jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  session: 'sess_xyz',
  session_id: 'sid_789',
  api_key: 'sk_live_xxx',
  bearer: 'Bearer token',
  client_secret: 'client_secret_value',
  passwd: 'passwd_value',
  mysql_pwd: 'mysql_pwd_value',
  private_key: '-----BEGIN PRIVATE KEY-----',
  ssh_key: 'ssh-rsa AAAA...',
  card: '4111111111111111',
  cardnumber: '5500000000000004',
  creditcard: '4111111111111111',
  pin: '1234',
  security_code: '999',
  stripetoken: 'tok_xxx',
  cloudpayments_public_id: 'pk_xxx',
  cloudpayments_secret: 'secret_xxx',
  dsn: 'postgres://user:pass@host/db',
  ssn: '123-45-6789',
};

describe('GrouperWorker', () => {
  const dataFilter = new DataFilter();

  describe('Data Filter', () => {
    test('should filter PAN numbers in context', async () => {
      const event = generateEvent({
        context: {
          cardPan: '5500 0000 0000 0004',
        },
      });

      dataFilter.processEvent(event);

      expect(event.context['cardPan']).toBe('[filtered]');
    });

    test('should filter PAN numbers in addons', async () => {
      const event = generateEvent({
        addons: {
          vue: {
            props: {
              cardPan: '5500 0000 0000 0004',
            },
          },
        },
      });

      dataFilter.processEvent(event);

      expect(event.addons['vue']['props']['cardPan']).toBe('[filtered]');
    });

    test('should not replace values if they are not a PAN number', async () => {
      const normalValue = 'test123';
      const event = generateEvent({
        context: {
          normalKey: normalValue,
        },
        addons: {
          vue: {
            props: {
              normalKey: normalValue,
            },
          },
        },
      });

      dataFilter.processEvent(event);

      expect(event.context['normalKey']).toBe(normalValue);
      expect(event.addons['vue']['props']['normalKey']).toBe(normalValue);
    });

    test('should filter values of matched keynames in context', async () => {
      const event = generateEvent({
        context: sensitiveDataMock,
      });

      dataFilter.processEvent(event);

      Object.keys(sensitiveDataMock).forEach((key) => {
        expect(event.context[key]).toBe('[filtered]');
      });
    });

    test('should filter values of matched keynames in addons', async () => {
      const event = generateEvent({
        addons: {
          vue: {
            props: sensitiveDataMock,
          },
        },
      });

      dataFilter.processEvent(event);

      Object.keys(sensitiveDataMock).forEach((key) => {
        expect(event.addons['vue']['props'][key]).toBe('[filtered]');
      });
    });

    test('should filter additional sensitive keys (authorization, token, payment, dsn, ssn, etc.) in context', async () => {
      const event = generateEvent({
        context: additionalSensitiveDataMock,
      });

      dataFilter.processEvent(event);

      Object.keys(additionalSensitiveDataMock).forEach((key) => {
        expect(event.context[key]).toBe('[filtered]');
      });
    });

    test('should filter additional sensitive keys in addons', async () => {
      const event = generateEvent({
        addons: {
          vue: {
            props: additionalSensitiveDataMock,
          },
        },
      });

      dataFilter.processEvent(event);

      Object.keys(additionalSensitiveDataMock).forEach((key) => {
        expect(event.addons['vue']['props'][key]).toBe('[filtered]');
      });
    });

    test('should not replace values with keynames not in a list', async () => {
      const normalValue = 'test123';
      const event = generateEvent({
        context: {
          normalKey: normalValue,
        },
        addons: {
          vue: {
            props: {
              normalKey: normalValue,
            },
          },
        },
      });

      dataFilter.processEvent(event);

      expect(event.context['normalKey']).toBe(normalValue);
      expect(event.addons['vue']['props']['normalKey']).toBe(normalValue);
    });
  });
});
