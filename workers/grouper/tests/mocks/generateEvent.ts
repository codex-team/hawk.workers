import type { EventAddons, EventData } from '@hawk.so/types';
import { generateRandomId } from './randomId';

/**
 * Mocked User id used for tests
 */
const userIdMock = generateRandomId();

/**
 * Generate mocked event
 *
 * @param event - Partial event data to override default values
 */
export function generateEvent(event: Partial<EventData<EventAddons>> = undefined): EventData<EventAddons> {
  return {
    title: 'Hawk client catcher test',
    backtrace: [],
    user: {
      id: userIdMock,
    },
    context: {
      testField: 8,
      'ima$ge.jpg': 'img',
    },
    addons: {
      vue: {
        props: {
          'test-test': false,
          'ima$ge.jpg': 'img',
        },
      },
    },
    ...event,
  };
}
