import type { GroupedEventDBScheme, RepetitionDBScheme } from '@hawk.so/types';

type RepetitionRelease = Pick<RepetitionDBScheme, 'groupHash' | 'release'>;

/**
 * Build a lookup set of releases in which each event occurred.
 *
 * Repetitions are deduplicated by event and release in MongoDB before this
 * function is called. Therefore, memory usage depends on the number of unique
 * releases per event rather than the potentially much larger repetition count.
 * Release ordering is handled separately by the validation flow.
 *
 * @param events - original events from the current validation batch
 * @param repetitions - unique event and release pairs from MongoDB
 */
export function buildEventReleaseMap(
  events: GroupedEventDBScheme[],
  repetitions: RepetitionRelease[]
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
