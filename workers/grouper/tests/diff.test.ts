import { patch } from '@n1ru4l/json-patch-plus';
import '../../../env-test';

import { computeDelta } from '../src/utils/repetitionDiff';
import { generateEvent } from './mocks/generateEvent';

/**
 * Check that we always can get the whole repetition by applying delta to the original event
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
});
