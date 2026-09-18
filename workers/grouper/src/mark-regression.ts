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
 */
export async function markRegression(
  db: Db,
  projectId: string,
  groupHash: string,
  release: string,
  resolvedInRelease: string
): Promise<void> {
  const releases = await db.collection<ReleaseRecord>('releases').find({
    projectId,
    release: {
      $in: [resolvedInRelease, release],
    },
  })
    .toArray();
  const resolvedRelease = releases.find(item => item.release === resolvedInRelease);
  const repetitionRelease = releases.find(item => item.release === release);

  if (!resolvedRelease || !repetitionRelease) {
    return;
  }

  const isResolvedOrNewerRelease = repetitionRelease._id.toHexString() >= resolvedRelease._id.toHexString();

  if (!isResolvedOrNewerRelease) {
    return;
  }

  await db.collection(`events:${projectId}`).updateOne({
    groupHash,
    resolvedInRelease,
    regressionInRelease: { $exists: false },
  }, {
    $set: {
      regressionInRelease: release,
    },
  });
}
