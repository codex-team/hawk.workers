import { ObjectID } from 'mongodb';
import type { GroupedEventDBScheme, RepetitionDBScheme } from '@hawk.so/types';
import { buildEventReleaseMap } from '../../src/utils/build-event-release-map';

/**
 * Create an original event.
 *
 * @param groupHash - event group hash
 * @param release - release in which the event first occurred
 */
function createEvent(groupHash: string, release?: string): GroupedEventDBScheme {
  return {
    _id: new ObjectID(),
    groupHash,
    payload: {
      title: groupHash,
      ...(release ? { release } : {}),
    },
    totalCount: 1,
    catcherType: 'errors/default',
    usersAffected: 0,
    visitedBy: [],
    timestamp: 1,
  };
}

/**
 * Create an event repetition.
 *
 * @param groupHash - event group hash
 * @param release - release in which the event occurred
 */
function createRepetition(groupHash: string, release?: string): RepetitionDBScheme {
  return {
    groupHash,
    timestamp: 1,
    ...(release ? { release } : {}),
  };
}

describe('buildEventReleaseMap', () => {
  test('should build the release map from original events and repetitions', () => {
    // Arrange
    const events = [
      createEvent('error-1', 'a'),
      createEvent('error-2', 'a'),
      createEvent('error-3', 'a'),
    ];
    const repetitions = [
      createRepetition('error-1', 'b'),
      createRepetition('error-1', 'c'),
      createRepetition('error-2', 'b'),
      createRepetition('error-3', 'b'),
      createRepetition('error-3', 'c'),
      createRepetition('error-3', 'd'),
      createRepetition('error-3', 'e'),
    ];

    // Act
    const result = buildEventReleaseMap(events, repetitions);

    // Assert
    expect(Array.from(result.entries()).map(([groupHash, releases]) => {
      return [groupHash, Array.from(releases)];
    })).toEqual([
      ['error-1', ['a', 'b', 'c'] ],
      ['error-2', ['a', 'b'] ],
      ['error-3', ['a', 'b', 'c', 'd', 'e'] ],
    ]);
  });

  test('should ignore duplicate releases and repetitions without matching events', () => {
    // Arrange
    const events = [
      createEvent('error-1', 'a'),
      createEvent('error-without-release'),
    ];
    const repetitions = [
      createRepetition('error-1', 'a'),
      createRepetition('error-1', 'b'),
      createRepetition('error-1', 'b'),
      createRepetition('error-1'),
      createRepetition('unknown-error', 'c'),
    ];

    // Act
    const result = buildEventReleaseMap(events, repetitions);

    // Assert
    expect(Array.from(result.entries()).map(([groupHash, releases]) => {
      return [groupHash, Array.from(releases)];
    })).toEqual([
      ['error-1', ['a', 'b'] ],
      ['error-without-release', [] ],
    ]);
  });
});
