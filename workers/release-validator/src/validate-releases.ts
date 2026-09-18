import { Db, ObjectID } from 'mongodb';
import type { GroupedEventDBScheme, ReleaseDBScheme, RepetitionDBScheme } from '@hawk.so/types';
import { HOURS_IN_DAY, MINUTES_IN_HOUR, MS_IN_SEC, SECONDS_IN_MINUTE } from '../../../lib/utils/consts';
import { buildEventReleaseMap } from './utils/build-event-release-map';
import { groupReleasesByProject } from './utils/group-releases-by-project';

const RELEASE_OBSERVATION_PERIOD_SECONDS = HOURS_IN_DAY * MINUTES_IN_HOUR * SECONDS_IN_MINUTE;
const RELEASE_MAX_AGE_DAYS = 30;
const RELEASE_MAX_AGE_SECONDS = RELEASE_MAX_AGE_DAYS * RELEASE_OBSERVATION_PERIOD_SECONDS;

/**
 * Find unchecked releases older than the observation period.
 *
 * @param db - events database connection
 * @param now - current time
 */
async function findReleasesToCheck(db: Db, now: Date): Promise<ReleaseDBScheme[]> {
  const nowSeconds = Math.floor(now.getTime() / MS_IN_SEC);
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
  const releasesByName = new Map<string, ReleaseDBScheme>();

  for (const release of allProjectReleases) {
    releasesByName.set(release.release, release);
  }

  const events = await eventsCollection.find({
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
    ],
  }).toArray();
  const eventGroupHashes = events.map(event => event.groupHash);
  const repetitions = await repetitionsCollection.find({
    groupHash: { $in: eventGroupHashes },
    release: {
      $type: 'string',
      $ne: '',
    },
  }).toArray();
  const eventReleases = buildEventReleaseMap(events, repetitions);

  for (const event of events) {
    const originalReleaseName = event.payload.release;
    const originalRelease = releasesByName.get(originalReleaseName);

    if (!originalRelease) {
      continue;
    }

    const releasesWithEvent = eventReleases.get(event.groupHash) || new Set<string>();

    for (const release of releasesToCheck) {
      const releaseId = release._id.toHexString();
      const isNewerThanOriginal = releaseId > originalRelease._id.toHexString();
      const occurredInRelease = releasesWithEvent.has(release.release);
      const occurredInNewerRelease = allProjectReleases.some(projectRelease => {
        return projectRelease._id.toHexString() > releaseId && releasesWithEvent.has(projectRelease.release);
      });

      if (!isNewerThanOriginal || occurredInRelease || occurredInNewerRelease) {
        continue;
      }

      await eventsCollection.updateOne({
        _id: event._id,
        $or: [
          { resolvedInRelease: { $exists: false } },
          { resolvedInRelease: null },
        ],
      }, {
        $set: {
          resolvedInRelease: release.release,
        },
      });

      break;
    }
  }

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
  const releasesToCheck = await findReleasesToCheck(db, now);
  const releasesByProject = groupReleasesByProject(releasesToCheck);

  for (const [projectId, projectReleases] of releasesByProject) {
    await validateProject(db, projectId, projectReleases);
  }
}
