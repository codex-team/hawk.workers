import { patch } from '@n1ru4l/json-patch-plus';
import '../../../env-test';

import { computeDelta } from '../src/utils/repetitionDiff';
import { generateEvent } from './mocks/generateEvent';
import { generateTask } from './mocks/generateTask';

/**
 * @todo
 * - create event mock
 * - create repetition mock
 * - get diff
 * - use patch to check diff — you should get repetition
 */
describe('Diff', () => {
  it('saved delta should allow to get the original repetition using patch', () => {
    const originalEvent = generateEvent()

    const repetition = generateEvent({
      backtrace: null,
      context: {
        testField: 10,
      },
    });

    const delta = computeDelta(originalEvent, repetition);

    const patched = patch({
      left: originalEvent,
      delta,
    });

    expect(patched).toEqual(repetition);
  })


  /**
  it('should return empty object if there is no difference', () => {
    const originalEvent = {
      title: 'Event title',
      addons: {
        field1: 'TypeError',
      },
    };

    const repetition = {
      title: 'Event title',
      addons: {
        field1: 'TypeError',
      },
    };

    const result = repetitionDiff(originalEvent, repetition);

    expect(result).toEqual({});
  });

  it('should return difference between two objects', () => {
    const originalEvent = {
      title: 'Event title',
      addons: {
        field1: 'TypeError',
      },
    };

    const repetition = {
      title: 'Event title',
      addons: {
        field1: 'ReferenceError',
      },
    };

    const result = repetitionDiff(originalEvent, repetition);

    expect(result).toEqual({
      addons: {
        field1: 'ReferenceError',
      },
    });
  });

  it('should save field with "undefined" value if it exists in original, but not in repetition', () => {
    const originalEvent = {
      title: 'Event title',
      addons: {
        field1: 'Field 1',
      },
    };

    const repetition = {
      title: 'Event title',
      addons: {
        field2: 'Field 2',
      },
    };

    const result = repetitionDiff(originalEvent, repetition);

    expect(result).toEqual({
      addons: {
        field1: undefined,
        field2: 'Field 2',
      },
    });
  });

  it('should preserve "undefined" value if repetition has it', () => {
    const originalEvent = {
      title: 'Event title',
      addons: {
        field1: 'Field 1',
      },
    };

    const repetition = {
      title: 'Event title',
      addons: {
        field1: undefined,
      },
    };

    const result = repetitionDiff(originalEvent, repetition);

    expect(result).toEqual({
      addons: {
        field1: undefined,
      },
    });
  });

  it('should return difference between two objects with arrays', () => {
    const originalEvent = {
      title: 'Event title',
      addons: {
        field1: [1, 2, 3],
      },
    };

    const repetition = {
      title: 'Event title',
      addons: {
        field1: [11, 22, 33]
      },
    };

    const result = repetitionDiff(originalEvent, repetition);

    expect(result).toEqual({
      addons: {
        field1: [11, 22, 33],
      },
    });
  });

  it('should return difference in nested objects', () => {
    const originalEvent = {
      title: 'Event title',
      addons: {
        field1: {
          field2: 'Field 2',
          field22: {
            field222: [
              {
                field2222: 'Field 2222',
                fiels3333: 'Field 3333',
              }
            ]
          }
        },
      },
    };

    const repetition = {
      title: 'Event title',
      addons: {
        field1: {
          field2: 'Field 22',
          field22: {
            field222: [
              {
                field2222: 'Field 2222',
                fiels3333: 'Field 4444',
                field5555: 'Field 5555',
              }
            ]
          }
        },
      },
    };

    const result = repetitionDiff(originalEvent, repetition);

    expect(result).toEqual({
      addons: {
        field1: {
          field2: 'Field 22',
          field22: {
            field222: [
              {
                field2222: 'Field 2222',
                fiels3333: 'Field 4444',
                field5555: 'Field 5555',
              }
            ]
          }
        },
      },
    });
  });

  */
});
