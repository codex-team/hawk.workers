import '../../../env-test';
import { EventAddons, EventDataAccepted, Json } from '@hawk.so/types';
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
function generateEvent({ context, addons }: {context?: Json, addons?: EventAddons}): EventDataAccepted<EventAddons> {
  return {
    title: 'Event with sensitive data',
    timestamp: (new Date()).getTime(),
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

describe.skip('GrouperWorker', () => {
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
  });
});
