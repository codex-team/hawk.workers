import type { DefaultAddons, EventAddons, EventData, JavaScriptAddons } from '@hawk.so/types';
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
export function generateEvent(event: Partial<EventData<JavaScriptAddons>> = undefined): EventData<JavaScriptAddons> {
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
      window: {
        innerWidth: 1024,
        innerHeight: 768,
      },
      userAgent: 'Hawk client catcher test',
      url: 'https://hawk.so',
      vue: {
        props: {
          'test-test': false,
          'ima$ge.jpg': 'img',
        },
        lifecycle: 'Mounted',
        component: 'TestComponent',
      },
    },
    ...event,
  };
}
