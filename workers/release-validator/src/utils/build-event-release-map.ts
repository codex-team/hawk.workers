import { EventRecord, RepetitionRecord } from '../types';

/**
 * Build a map of releases in which each event occurred.
 *
 * @param events - original events
 * @param repetitions - event repetitions
 */
export function buildEventReleaseMap(
  events: EventRecord[],
  repetitions: RepetitionRecord[]
): Map<string, Set<string>> {
  const releasesByGroupHash = new Map<string, Set<string>>();

  for (const event of events) {
    const releases = new Set<string>();

    if (event.payload?.release) {
      releases.add(event.payload.release);
    }

    releasesByGroupHash.set(event.groupHash, releases);
  }

  for (const repetition of repetitions) {
    if (!repetition.release) {
      continue;
    }

    const releases = releasesByGroupHash.get(repetition.groupHash);

    if (releases) {
      releases.add(repetition.release);
    }
  }

  return releasesByGroupHash;
}
