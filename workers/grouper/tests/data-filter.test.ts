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
function generateEvent({ context, addons, backtrace, breadcrumbs }: {
  context?: Json,
  addons?: EventAddons,
  backtrace?: EventData<EventAddons>['backtrace'],
  breadcrumbs?: EventData<EventAddons>['breadcrumbs'],
}): EventData<EventAddons> {
  return {
    title: 'Event with sensitive data',
    backtrace: backtrace ?? [],
    ...(context && {
      context,
    }),
    ...(addons && {
      addons,
    }),
    ...(breadcrumbs && {
      breadcrumbs,
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
      /**
       * Split the mock into two groups to keep objects under the sanitizer keys limit
       */
      const entries = Object.entries(additionalSensitiveDataMock);
      const half = Math.ceil(entries.length / 2);
      const event = generateEvent({
        context: {
          group1: Object.fromEntries(entries.slice(0, half)),
          group2: Object.fromEntries(entries.slice(half)),
        },
      });

      dataFilter.processEvent(event);

      entries.slice(0, half).forEach(([ key ]) => {
        expect(event.context['group1'][key]).toBe('[filtered]');
      });
      entries.slice(half).forEach(([ key ]) => {
        expect(event.context['group2'][key]).toBe('[filtered]');
      });
    });

    test('should filter additional sensitive keys in addons', async () => {
      /**
       * Split the mock into two groups to keep objects under the sanitizer keys limit
       */
      const entries = Object.entries(additionalSensitiveDataMock);
      const half = Math.ceil(entries.length / 2);
      const event = generateEvent({
        addons: {
          vue: {
            props: {
              group1: Object.fromEntries(entries.slice(0, half)),
              group2: Object.fromEntries(entries.slice(half)),
            },
          },
        },
      });

      dataFilter.processEvent(event);

      entries.slice(0, half).forEach(([ key ]) => {
        expect(event.addons['vue']['props']['group1'][key]).toBe('[filtered]');
      });
      entries.slice(half).forEach(([ key ]) => {
        expect(event.addons['vue']['props']['group2'][key]).toBe('[filtered]');
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

    test('should replace too deep objects with a placeholder and keep filtering reachable levels', () => {
      // Create an object nested deeper than the sanitizer depth cap
      let deeplyNested: any = { value: 'leaf', secret: 'should-be-cut-off' };

      for (let i = 0; i < 25; i++) {
        deeplyNested = { [`level${i}`]: deeplyNested, password: `sensitive${i}` };
      }

      const event = generateEvent({
        context: deeplyNested,
      });

      // This should not throw or cause memory issues
      dataFilter.processEvent(event);

      // Filtering still works on the levels kept by the sanitizer
      expect(event.context['password']).toBe('[filtered]');

      const deepestKeptLevel = event.context['level24']['level23']['level22']['level21'];

      expect(deepestKeptLevel['password']).toBe('[filtered]');

      // Everything deeper is replaced with a placeholder
      expect(deepestKeptLevel['level20']).toBe('<deep object>');
    });
  });

  describe('Sanitizer', () => {
    test('should trim long strings in context', () => {
      const longString = 'a'.repeat(5000);
      const event = generateEvent({
        context: {
          longValue: longString,
        },
      });

      dataFilter.processEvent(event);

      expect(event.context['longValue']).toBe('a'.repeat(200) + '…');
    });

    test('should cut off extra keys of nested objects with too many keys', () => {
      const bigObject: Record<string, number> = {};

      for (let i = 0; i < 25; i++) {
        bigObject[`key${i}`] = i;
      }

      const event = generateEvent({
        context: {
          bigObject,
        },
      });

      dataFilter.processEvent(event);

      expect(Object.keys(event.context['bigObject'])).toHaveLength(21);
      expect(event.context['bigObject']['__meta']).toBe('5 more key(s) skipped');
    });

    test('should slice long arrays and add a placeholder', () => {
      const event = generateEvent({
        context: {
          longArray: new Array(15).fill('item') as unknown as Json,
        },
      });

      dataFilter.processEvent(event);

      const sanitizedArray = event.context['longArray'];

      expect(sanitizedArray).toHaveLength(11); // 10 items + placeholder
      expect(sanitizedArray[10]).toBe('<5 more items...>');
    });

    test('should sanitize addons', () => {
      const event = generateEvent({
        addons: {
          vue: {
            props: {
              longValue: 'b'.repeat(5000),
            },
          },
        },
      });

      dataFilter.processEvent(event);

      expect(event.addons['vue']['props']['longValue']).toBe('b'.repeat(200) + '…');
    });

    test('should trim long backtrace frame arguments', () => {
      const event = generateEvent({
        backtrace: [ {
          file: 'index.js',
          line: 1,
          arguments: [ 'c'.repeat(5000) ],
        } ],
      });

      dataFilter.processEvent(event);

      expect(event.backtrace[0].arguments[0]).toBe('c'.repeat(200) + '…');
    });

    test('should sanitize breadcrumbs message and data', () => {
      const event = generateEvent({
        breadcrumbs: [ {
          timestamp: 1701867896789,
          message: 'd'.repeat(5000),
          data: {
            longValue: 'e'.repeat(5000),
          },
        } ],
      });

      dataFilter.processEvent(event);

      expect(event.breadcrumbs[0].message).toBe('d'.repeat(200) + '…');
      expect(event.breadcrumbs[0].data['longValue']).toBe('e'.repeat(200) + '…');
    });

    test('should keep the first keys of a big object and report the skipped ones', () => {
      const bigContext: Record<string, number> = {};

      for (let i = 0; i < 25; i++) {
        bigContext[`key${i}`] = i;
      }

      const event = generateEvent({
        context: bigContext,
      });

      dataFilter.processEvent(event);

      expect(Object.keys(event.context)).toHaveLength(21);
      expect(event.context['key0']).toBe(0);
      expect(event.context['key19']).toBe(19);
      expect(event.context['key20']).toBeUndefined();
      expect(event.context['__meta']).toBe('5 more key(s) skipped');
    });

    test('should replace circular references with a placeholder', () => {
      const circular: Record<string, unknown> = {
        name: 'circular',
      };

      circular.self = circular;

      const event = generateEvent({
        context: circular as Json,
      });

      dataFilter.processEvent(event);

      expect(event.context['name']).toBe('circular');
      expect(event.context['self']).toBe('<circular>');
    });
  });

  describe('Backtrace trimming', () => {
    test('should cap backtrace frames and sourceCode lines', () => {
      const longLine = 'x'.repeat(300);
      const backtrace = Array.from({ length: 80 }, (_, index) => {
        return {
          file: `frame-${index}.rb`,
          line: index + 1,
          sourceCode: Array.from({ length: 25 }, (__, lineIndex) => {
            return {
              line: lineIndex + 1,
              content: longLine,
            };
          }),
        };
      });
      const event = generateEvent({ backtrace });

      dataFilter.processEvent(event);

      expect(event.backtrace).toHaveLength(20);
      expect(event.backtrace?.[0].sourceCode).toHaveLength(21);
      expect(event.backtrace?.[0].sourceCode?.[0].content?.endsWith('…')).toBe(true);
      expect(event.backtrace?.[0].sourceCode?.[0].content?.length).toBeLessThanOrEqual(141);
    });

    test('should normalize empty backtrace to undefined', () => {
      const event = generateEvent({ backtrace: [] });

      dataFilter.processEvent(event);

      expect(event.backtrace).toBeUndefined();
    });
  });
});
