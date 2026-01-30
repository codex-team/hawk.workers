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
  auth: 'C4CA4238A0B923820DCC509A6F75849B',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  access_token: '70BA33708CBFB103F1A8E34AFEF333BA7DC021022B2D9AAA583AABB8058D8D67',
  accessToken: '70BA33708CBFB103F1A8E34AFEF333BA7DC021022B2D9AAA583AABB8058D8D67',
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

    test('should not filter UUID values', async () => {
      const uuidV4 = '550e8400-e29b-41d4-a716-446655440000';
      const uuidV4Upper = '550E8400-E29B-41D4-A716-446655440000';
      const uuidWithoutDashes = '550e8400e29b41d4a716446655440000';

      const event = generateEvent({
        context: {
          userId: uuidV4,
          sessionId: uuidV4Upper,
          transactionId: uuidWithoutDashes,
          requestId: uuidV4,
        },
        addons: {
          vue: {
            props: {
              componentId: uuidV4,
            },
          },
        },
      });

      dataFilter.processEvent(event);

      expect(event.context['userId']).toBe(uuidV4);
      expect(event.context['sessionId']).toBe(uuidV4Upper);
      expect(event.context['transactionId']).toBe(uuidWithoutDashes);
      expect(event.context['requestId']).toBe(uuidV4);
      expect(event.addons['vue']['props']['componentId']).toBe(uuidV4);
    });

    test('should not filter MongoDB ObjectId values in context and addons', async () => {
      const objectId = '507f1f77bcf86cd799439011';
      const objectIdUpper = '507F1F77BCF86CD799439011';
      /** ObjectId that contains only digits (could be mistaken for PAN) */
      const numericObjectId = '672808419583041003090824';

      const event = generateEvent({
        context: {
          projectId: objectId,
          workspaceId: objectIdUpper,
          numericProjectId: numericObjectId,
        },
        addons: {
          hawk: {
            projectId: objectId,
          },
        },
      });

      dataFilter.processEvent(event);

      expect(event.context['projectId']).toBe(objectId);
      expect(event.context['workspaceId']).toBe(objectIdUpper);
      expect(event.context['numericProjectId']).toBe(numericObjectId);
      expect(event.addons['hawk']['projectId']).toBe(objectId);
    });

    test('should still filter actual PAN numbers even if they have some letters', async () => {
      // This is a real Mastercard test number with some formatting
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
  });
});
