/**
 * @file Dual-write helper for unified events/repetitions collections
 *
 * Writes to unified collections (events, repetitions) with projectId.
 * Used when USE_UNIFIED_EVENTS_COLLECTIONS=true.
 * Errors are logged, not thrown — dual-write must not break main flow.
 *
 * @see docs/mongodb-unified-collections/
 */

import { ObjectId } from 'mongodb';
import type { Db } from 'mongodb';
import { incrementDualWriteFailure } from '../../metrics/dualWrite';

const EVENTS_COLLECTION = 'events';
const REPETITIONS_COLLECTION = 'repetitions';

let _projectIdsCache: Set<string> | null = null;

function getUnifiedProjectIds(): Set<string> {
  if (_projectIdsCache !== null) return _projectIdsCache;
  const raw = process.env.UNIFIED_EVENTS_PROJECT_IDS ?? '';
  const ids = raw.split(',').map((id) => id.trim()).filter(Boolean);
  _projectIdsCache = new Set(ids);
  return _projectIdsCache;
}

function isUnifiedEnabledForProject(projectId: string): boolean {
  if (process.env.USE_UNIFIED_EVENTS_COLLECTIONS !== 'true') return false;
  const ids = getUnifiedProjectIds();
  if (ids.size === 0) return false;
  return ids.has(projectId);
}

function toObjectId(projectId: string): ObjectId {
  return new ObjectId(projectId);
}

/**
 * Insert event into unified events collection with projectId
 *
 * @param db - MongoDB Db instance (hawk_events)
 * @param projectId - project ObjectId as string
 * @param doc - event document (without projectId)
 * @param insertedId - _id from original insert (to keep consistency)
 */
export async function insertEventUnified(
  db: Db,
  projectId: string,
  doc: Record<string, unknown>,
  insertedId: ObjectId
): Promise<void> {
  if (!isUnifiedEnabledForProject(projectId)) return;

  try {
    const unifiedDoc = {
      ...doc,
      projectId: toObjectId(projectId),
      _id: insertedId,
    };
    await db.collection(EVENTS_COLLECTION).insertOne(unifiedDoc);
  } catch {
    incrementDualWriteFailure('events');
  }
}

/**
 * Insert repetition into unified repetitions collection with projectId
 *
 * @param db - MongoDB Db instance (hawk_events)
 * @param projectId - project ObjectId as string
 * @param doc - repetition document (without projectId)
 * @param insertedId - _id from original insert (to keep consistency)
 */
export async function insertRepetitionUnified(
  db: Db,
  projectId: string,
  doc: Record<string, unknown>,
  insertedId: ObjectId
): Promise<void> {
  if (!isUnifiedEnabledForProject(projectId)) return;

  try {
    const unifiedDoc = {
      ...doc,
      projectId: toObjectId(projectId),
      _id: insertedId,
    };
    await db.collection(REPETITIONS_COLLECTION).insertOne(unifiedDoc);
  } catch {
    incrementDualWriteFailure('repetitions');
  }
}

/**
 * Ensure event exists in unified collection, then increment counter.
 * Used when processing repetitions for events created before dual-write was enabled.
 */
export async function ensureEventAndIncrementUnified(
  db: Db,
  projectId: string,
  groupHash: string,
  eventDoc: Record<string, unknown>,
  incrementAffected: boolean
): Promise<void> {
  if (!isUnifiedEnabledForProject(projectId)) return;

  const projectIdObj = toObjectId(projectId);
  const collection = db.collection(EVENTS_COLLECTION);

  try {
    const existing = await collection.findOne({ projectId: projectIdObj, groupHash });
    if (!existing) {
      const unifiedDoc = { ...eventDoc, projectId: projectIdObj };
      await collection.insertOne(unifiedDoc);
    }

    const updateQuery = incrementAffected
      ? { $inc: { totalCount: 1, usersAffected: 1 } }
      : { $inc: { totalCount: 1 } };

    await collection.updateOne(
      { projectId: projectIdObj, groupHash },
      updateQuery
    );
  } catch {
    incrementDualWriteFailure('events');
  }
}
