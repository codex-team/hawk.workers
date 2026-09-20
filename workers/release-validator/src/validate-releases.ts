import { Collection, Db, ObjectID } from 'mongodb';
import type { GroupedEventDBScheme, ReleaseDBScheme, RepetitionDBScheme } from '@hawk.so/types';
import { HOURS_IN_DAY, MINUTES_IN_HOUR, MS_IN_SEC, SECONDS_IN_MINUTE } from '../../../lib/utils/consts';
import { buildEventReleaseMap } from './utils/build-event-release-map';
import { groupReleasesByProject } from './utils/group-releases-by-project';

const RELEASE_OBSERVATION_PERIOD_SECONDS = HOURS_IN_DAY * MINUTES_IN_HOUR * SECONDS_IN_MINUTE;
const RELEASE_MAX_AGE_DAYS = 30;
const RELEASE_MAX_AGE_SECONDS = RELEASE_MAX_AGE_DAYS * RELEASE_OBSERVATION_PERIOD_SECONDS;

/**
 * Maximum number of events processed in one validation batch.
 *
 * A bounded batch keeps the repetitions `$in` query below MongoDB document
 * limits and prevents large projects from loading all events and repetitions
 * into worker memory at once.
 */
const EVENTS_BATCH_SIZE = 500;

/**
 * Find unchecked releases older than the observation period.
 *
 * @param db - events database connection
 * @param now - current time
 */
async function findReleasesToCheck(db: Db, now: Date): Promise<ReleaseDBScheme[]> {
  const nowSeconds = Math.floor(now.getTime() / MS_IN_SEC);

  /**
   * Limit candidates to the rollout window: releases must be old enough to
   * observe for 24 hours, but recent enough to contain release-aware repetitions.
   */
  const oldestReleaseId = ObjectID.createFromTime(nowSeconds - RELEASE_MAX_AGE_SECONDS);
  const newestReleaseId = ObjectID.createFromTime(nowSeconds - RELEASE_OBSERVATION_PERIOD_SECONDS);

  return db.collection<ReleaseDBScheme>('releases')
    .find({
      _id: {
        $gte: oldestReleaseId,
        $lt: newestReleaseId,
      },
      projectId: {
        $type: 'string',
        $ne: '',
      },
      release: {
        $type: 'string',
        $ne: '',
      },
      fixChecked: { $ne: true },
    })
    .sort({ _id: 1 })
    .toArray();
}

/**
 * Validate a bounded portion of project events.
 *
 * Only the repetition fields required to build the occurrence lookup are
 * projected. This avoids transferring serialized deltas and payloads that are
 * not used by release validation.
 *
 * @param events - current event portion
 * @param eventsCollection - project events collection
 * @param repetitionsCollection - project repetitions collection
 * @param releasesToCheck - ready releases ordered from oldest to newest
 * @param allProjectReleases - complete project release history
 * @param releasesByName - project releases indexed by release name
 */
async function validateEventsBatch(
  events: GroupedEventDBScheme[],
  eventsCollection: Collection<GroupedEventDBScheme>,
  repetitionsCollection: Collection<RepetitionDBScheme>,
  releasesToCheck: ReleaseDBScheme[],
  allProjectReleases: ReleaseDBScheme[],
  releasesByName: Map<string, ReleaseDBScheme>
): Promise<void> {
  const eventGroupHashes = events.map(event => event.groupHash);
  const repetitions = await repetitionsCollection.find({
    groupHash: { $in: eventGroupHashes },
    release: {
      $type: 'string',
      $ne: '',
    },
  }, {
    projection: {
      _id: 0,
      groupHash: 1,
      release: 1,
    },
  }).toArray();
  const eventReleases = buildEventReleaseMap(events, repetitions);

  /**
   * Resolve each event in the first eligible release after its latest known
   * occurrence. A later occurrence blocks resolution in an older release.
   */
  for (const event of events) {
    /**
     * The original event release is the initial occurrence boundary.
     */
    const originalRelease = releasesByName.get(event.payload.release);
    let lastOccurrenceRelease = originalRelease;

    /**
     * For a regressed event, continue validation from the regression release
     * instead of its original release. This enables repeated resolve cycles.
     */
    if (event.resolvedInRelease && event.regressionInRelease) {
      const resolvedRelease = releasesByName.get(event.resolvedInRelease);
      const regressionRelease = releasesByName.get(event.regressionInRelease);

      /**
       * Without both release records their chronological relation is unknown,
       * so the event cannot be safely resolved again.
       */
      if (!resolvedRelease || !regressionRelease) {
        continue;
      }

      const isCurrentlyRegressed = regressionRelease._id.toHexString() >= resolvedRelease._id.toHexString();

      /**
       * A regression older than the current resolution belongs to a previous
       * cycle and does not make the event eligible for another resolution.
       */
      if (!isCurrentlyRegressed) {
        continue;
      }

      lastOccurrenceRelease = regressionRelease;
    }

    /**
     * Skip events whose original or latest occurrence release is missing from
     * the project release history.
     */
    if (!lastOccurrenceRelease) {
      continue;
    }

    const releasesWithEvent = eventReleases.get(event.groupHash) || new Set<string>();

    for (const release of releasesToCheck) {
      const releaseId = release._id.toHexString();
      const isNewerThanLastOccurrence = releaseId > lastOccurrenceRelease._id.toHexString();
      const occurredInRelease = releasesWithEvent.has(release.release);

      /**
       * A repetition in any later release, including one younger than 24 hours,
       * proves that this candidate did not fix the event.
       */
      const occurredInNewerRelease = allProjectReleases.some(projectRelease => {
        return projectRelease._id.toHexString() > releaseId && releasesWithEvent.has(projectRelease.release);
      });

      if (!isNewerThanLastOccurrence || occurredInRelease || occurredInNewerRelease) {
        continue;
      }

      /**
       * Keep the state transition atomic. A concurrent Grouper update must make
       * this conditional update miss instead of overwriting newer state.
       */
      const eventState = event.regressionInRelease
        ? {
          resolvedInRelease: event.resolvedInRelease,
          regressionInRelease: event.regressionInRelease,
        }
        : {
          $or: [
            { resolvedInRelease: { $exists: false } },
            { resolvedInRelease: null },
          ],
        };

      await eventsCollection.updateOne({
        _id: event._id,
        ...eventState,
      }, {
        $set: {
          resolvedInRelease: release.release,
        },
      });

      /**
       * Releases are ordered from oldest to newest, so the first matching
       * candidate is the release in which the event became likely fixed.
       */
      break;
    }
  }
}

/**
 * Validate all ready releases of one project.
 *
 * @param db - events database connection
 * @param projectId - project identifier
 * @param releasesToCheck - ready releases ordered from oldest to newest
 */
async function validateProject(db: Db, projectId: string, releasesToCheck: ReleaseDBScheme[]): Promise<void> {
  const releasesCollection = db.collection<ReleaseDBScheme>('releases');
  const eventsCollection = db.collection<GroupedEventDBScheme>(`events:${projectId}`);
  const repetitionsCollection = db.collection<RepetitionDBScheme>(`repetitions:${projectId}`);

  /**
   * Load the complete release history. Releases outside the validation window
   * still define occurrence order and can block an incorrect resolution.
   */
  const allProjectReleases = await releasesCollection
    .find({
      projectId,
      release: {
        $type: 'string',
        $ne: '',
      },
    })
    .sort({ _id: 1 })
    .toArray();

  /**
   * Resolve release names to their Mongo records so ObjectIds can be used as
   * the chronological source of truth instead of comparing version strings.
   */
  const releasesByName = new Map<string, ReleaseDBScheme>();

  for (const release of allProjectReleases) {
    releasesByName.set(release.release, release);
  }

  /**
   * Stream eligible events from MongoDB instead of materializing the complete
   * project result. The cursor and application batch use the same limit so the
   * worker holds at most one bounded portion of event documents in memory.
   */
  const eventsCursor = eventsCollection.find({
    groupHash: {
      $type: 'string',
      $ne: '',
    },
    'payload.release': {
      $type: 'string',
      $ne: '',
    },
    $or: [
      { resolvedInRelease: { $exists: false } },
      { resolvedInRelease: null },
      {
        resolvedInRelease: {
          $type: 'string',
          $ne: '',
        },
        regressionInRelease: {
          $type: 'string',
          $ne: '',
        },
      },
    ],
  }, {
    projection: {
      _id: 1,
      groupHash: 1,
      'payload.release': 1,
      resolvedInRelease: 1,
      regressionInRelease: 1,
    },
  }).batchSize(EVENTS_BATCH_SIZE);
  let eventsBatch: GroupedEventDBScheme[] = [];

  while (await eventsCursor.hasNext()) {
    const event = await eventsCursor.next();

    if (!event) {
      break;
    }

    eventsBatch.push(event);

    if (eventsBatch.length < EVENTS_BATCH_SIZE) {
      continue;
    }

    await validateEventsBatch(
      eventsBatch,
      eventsCollection,
      repetitionsCollection,
      releasesToCheck,
      allProjectReleases,
      releasesByName
    );
    eventsBatch = [];
  }

  /**
   * Process the final partial portion left after the cursor is exhausted.
   */
  if (eventsBatch.length > 0) {
    await validateEventsBatch(
      eventsBatch,
      eventsCollection,
      repetitionsCollection,
      releasesToCheck,
      allProjectReleases,
      releasesByName
    );
  }

  /**
   * Mark releases only after every project batch finishes successfully.
   */
  await releasesCollection.updateMany({
    _id: {
      $in: releasesToCheck.map(release => release._id),
    },
  }, {
    $set: {
      fixChecked: true,
    },
  });
}

/**
 * Validate all releases whose observation period has elapsed.
 *
 * @param db - events database connection
 * @param now - current time
 */
export async function validateReleases(db: Db, now = new Date()): Promise<void> {
  /**
   * Candidate releases are globally ordered and then grouped so each project's
   * release history, events, and repetitions are loaded only once per run.
   */
  const releasesToCheck = await findReleasesToCheck(db, now);
  const releasesByProject = groupReleasesByProject(releasesToCheck);

  for (const [projectId, projectReleases] of releasesByProject) {
    await validateProject(db, projectId, projectReleases);
  }
}
