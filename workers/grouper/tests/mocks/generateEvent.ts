import { EventAddons, EventDataAccepted } from "@hawk.so/types";
import { generateRandomId } from "./randomId";

/**
 * Mocked User id used for tests
 */
const userIdMock = generateRandomId();


export function generateEvent(event: Partial<EventDataAccepted<EventAddons>> = undefined): EventDataAccepted<EventAddons> {
  return {
    title: 'Hawk client catcher test',
    timestamp: (new Date()).getTime(),
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
