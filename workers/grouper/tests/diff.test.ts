import { patch } from '@n1ru4l/json-patch-plus';
import '../../../env-test';

import { computeDelta } from '../src/utils/repetitionDiff';
import { generateEvent } from './mocks/generateEvent';

/**
 * Check that we always can get the whole repetition by applying delta to the original event
 */
describe('Diff', () => {
  it('Original event has backtrace, repetition has no backtrace, merged event has no backtrace', () => {
    const originalEvent = generateEvent();

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
  });
  it('Original event has no backtrace, repetition has backtrace, merged event has backtrace', () => {
    const originalEvent = generateEvent({
      backtrace: null,
      context: {
        testField: 10,
      },
    });

    const repetition = generateEvent({
      backtrace: [
        {
          file: 'test.ts',
          line: 10,
        },
      ],
    });

    const delta = computeDelta(originalEvent, repetition);

    const patched = patch({
      left: originalEvent,
      delta,
    });

    expect(patched).toEqual(repetition);
  });

  it('Original event and repetition have different backtrace', () => {
    const originalEvent = generateEvent({
      backtrace: [
        {
          file: 'test.ts',
          line: 10,
        },
      ],
    });

    const repetition = generateEvent({
      backtrace: [
        {
          file: 'test.ts',
          line: 11,
        },
      ],
    });

    const delta = computeDelta(originalEvent, repetition);

    const patched = patch({
      left: originalEvent,
      delta,
    });

    expect(patched.backtrace).toEqual(repetition.backtrace);
  });

  it('Original event has context with "someField" and repetition has no "someField"', () => {
    const originalEvent = generateEvent({
      context: {
        someField: 'someValue',
      },
    });

    const repetition = generateEvent({
      context: {},
    });

    const delta = computeDelta(originalEvent, repetition);

    const patched = patch({
      left: originalEvent,
      delta,
    });

    expect(patched.context).toEqual(repetition.context);
  });

  it('Original event has no context with "someField" and repetition has "someField"', () => {
    const originalEvent = generateEvent({
      context: {},
    });

    const repetition = generateEvent({
      context: {
        someField: 'someValue',
      },
    });

    const delta = computeDelta(originalEvent, repetition);

    const patched = patch({
      left: originalEvent,
      delta,
    });

    expect(patched.context).toEqual(repetition.context);
  });
});
