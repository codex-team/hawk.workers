import { Db, ObjectID } from 'mongodb';

interface ReleaseRecord {
  _id: ObjectID;
  projectId: string;
  release: string;
}

/**
 * Mark a resolved event as regressed in the resolved or a newer release.
 *
 * The update is atomic: only the first repetition after resolution sets the
 * regression release, and later repetitions do not overwrite it.
 *
 * @param db - events database connection
 * @param projectId - project identifier
 * @param groupHash - original event group hash
 * @param release - release in which the event occurred again
 * @param resolvedInRelease - release in which the event was resolved
 * @param regressionInRelease - regression from a previous resolution cycle
 */
export async function markRegression(
  db: Db,
  projectId: string,
  groupHash: string,
  release: string,
  resolvedInRelease: string,
  regressionInRelease?: string
): Promise<void> {
  const releases = await db.collection<ReleaseRecord>('releases').find({
    projectId,
    release: {
      $in: [resolvedInRelease, release, regressionInRelease].filter(Boolean),
    },
  })
    .toArray();
  const resolvedRelease = releases.find(item => item.release === resolvedInRelease);
  const repetitionRelease = releases.find(item => item.release === release);
  const previousRegressionRelease = regressionInRelease
    ? releases.find(item => item.release === regressionInRelease)
    : undefined;

  if (!resolvedRelease || !repetitionRelease) {
    return;
  }

  const resolvedReleaseId = resolvedRelease._id.toHexString();
  const isResolvedOrNewerRelease = repetitionRelease._id.toHexString() >= resolvedReleaseId;
  const hasRegressionForCurrentCycle = previousRegressionRelease &&
    previousRegressionRelease._id.toHexString() >= resolvedReleaseId;

  if (!isResolvedOrNewerRelease || hasRegressionForCurrentCycle) {
    return;
  }

  await db.collection(`events:${projectId}`).updateOne({
    groupHash,
    resolvedInRelease,
    ...(regressionInRelease
      ? { regressionInRelease }
      : { regressionInRelease: { $exists: false } }),
  }, {
    $set: {
      regressionInRelease: release,
    },
  });
}
