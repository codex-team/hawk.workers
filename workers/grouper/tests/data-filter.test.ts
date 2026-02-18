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
 * Example of object with sensitive information.
 * Keys intentionally use snake_case/kebab-case to match data-filter list.
 */
/* eslint-disable @typescript-eslint/naming-convention */
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
  access_token: '70BA33708CBFB103F1A8E34AFEF333BA7DC021022B2D9AAA583AABB8058D8D67',
  accessToken: '70BA33708CBFB103F1A8E34AFEF333BA7DC021022B2D9AAA583AABB8058D8D67',
};

/**
 * Additional sensitive keys (newly added / previously uncovered).
 * Keys intentionally use snake_case to match data-filter list.
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
/* eslint-enable @typescript-eslint/naming-convention */

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

    test('should not filter UUID values that contain exactly 16 digits', async () => {
      // These UUIDs contain exactly 16 digits, which when cleaned match PAN patterns
      // Without UUID detection, they would be incorrectly filtered as credit cards
      const uuidWithManyDigits = '4a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d'; // Cleans to 16 digits starting with 4
      const uuidUpperCase = '5A1B2C3D-4E5F-6A7B-8C9D-0E1F2A3B4C5D'; // Cleans to 16 digits starting with 5
      const uuidNoDashes = '2a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d'; // 32 hex chars without dashes

      const event = generateEvent({
        context: {
          userId: uuidWithManyDigits,
          requestId: uuidUpperCase,
          transactionId: uuidNoDashes,
        },
        addons: {
          vue: {
            props: {
              componentId: uuidWithManyDigits,
            },
          },
        },
      });

      dataFilter.processEvent(event);

      expect(event.context['userId']).toBe(uuidWithManyDigits);
      expect(event.context['requestId']).toBe(uuidUpperCase);
      expect(event.context['transactionId']).toBe(uuidNoDashes);
      expect(event.addons['vue']['props']['componentId']).toBe(uuidWithManyDigits);
    });

    test('should not filter MongoDB ObjectId values that contain exactly 16 digits', async () => {
      // These ObjectIds contain exactly 16 digits which when cleaned match PAN patterns
      // Without ObjectId detection, they would be incorrectly filtered as credit cards
      const objectIdWithManyDigits = '4111111111111111abcdefab'; // 16 digits + 8 hex letters = 24 chars, cleans to Visa pattern
      const objectIdUpperCase = '5111111111111111ABCDEFAB'; // Cleans to Mastercard pattern
      const objectIdMixedCase = '2111111111111111AbCdEfAb'; // Cleans to Maestro/Mastercard pattern

      const event = generateEvent({
        context: {
          projectId: objectIdWithManyDigits,
          workspaceId: objectIdUpperCase,
          transactionId: objectIdMixedCase,
        },
        addons: {
          hawk: {
            projectId: objectIdWithManyDigits,
          },
        },
      });

      dataFilter.processEvent(event);

      expect(event.context['projectId']).toBe(objectIdWithManyDigits);
      expect(event.context['workspaceId']).toBe(objectIdUpperCase);
      expect(event.context['transactionId']).toBe(objectIdMixedCase);
      expect(event.addons['hawk']['projectId']).toBe(objectIdWithManyDigits);
    });

    test('should still filter actual PAN numbers with formatting characters', async () => {
      // Test real Mastercard test number with spaces and dashes
      const panWithSpaces = '5500 0000 0000 0004';
      const panWithDashes = '5500-0000-0000-0004';

      const event = generateEvent({
        context: {
          cardNumber: panWithSpaces,
          paymentCard: panWithDashes,
        },
      });

      dataFilter.processEvent(event);

      expect(event.context['cardNumber']).toBe('[filtered]');
      expect(event.context['paymentCard']).toBe('[filtered]');
    });

    test('should not filter values that are not UUIDs, ObjectIds, or PANs', async () => {
      // These are edge cases that should NOT be filtered
      const shortHex = '507f1f77bcf86cd7'; // 16 hex chars (not 24)
      const longNumber = '67280841958304100309082499'; // 26 digits (too long for PAN)
      const mixedAlphaNum = 'abc123def456ghi789'; // Mixed content

      const event = generateEvent({
        context: {
          shortId: shortHex,
          longId: longNumber,
          mixedId: mixedAlphaNum,
        },
      });

      dataFilter.processEvent(event);

      expect(event.context['shortId']).toBe(shortHex);
      expect(event.context['longId']).toBe(longNumber);
      expect(event.context['mixedId']).toBe(mixedAlphaNum);
    });

    test('should filter UUIDs and ObjectIds when they are in sensitive key fields', async () => {
      // Even if the value is a valid UUID or ObjectId, it should be filtered
      // if the key name is in the sensitive keys list
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const objectId = '507f1f77bcf86cd799439011';

      const event = generateEvent({
        context: {
          password: uuid,
          secret: objectId,
          auth: '672808419583041003090824',
        },
      });

      dataFilter.processEvent(event);

      // All should be filtered because of sensitive key names
      expect(event.context['password']).toBe('[filtered]');
      expect(event.context['secret']).toBe('[filtered]');
      expect(event.context['auth']).toBe('[filtered]');
    });

    test('should handle deeply nested objects (>20 levels) without excessive memory allocations', () => {
      // Create an object nested deeper than the cap (>20 levels)
      let deeplyNested: any = { value: 'leaf', secret: 'should-be-filtered' };

      for (let i = 0; i < 25; i++) {
        deeplyNested = { [`level${i}`]: deeplyNested, password: `sensitive${i}` };
      }

      const event = generateEvent({
        context: deeplyNested,
      });

      // This should not throw or cause memory issues
      dataFilter.processEvent(event);

      // Verify that filtering still works at various depths
      expect(event.context['password']).toBe('[filtered]');

      // Navigate to a mid-level and check filtering
      let current = event.context['level24'] as any;
      for (let i = 24; i > 15; i--) {
        expect(current['password']).toBe('[filtered]');
        current = current[`level${i - 1}`];
      }

      // At the leaf level, the secret should still be filtered
      // (though path tracking may be capped, filtering should still work)
      let leaf = event.context;
      for (let i = 24; i >= 0; i--) {
        leaf = leaf[`level${i}`] as any;
      }
      expect(leaf['secret']).toBe('[filtered]');
    });
  });
});
