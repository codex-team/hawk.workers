/**
 * @file Dual-write to unified events/repetitions collections (Grouper layer)
 *
 * Thin wrappers around lib/db/unified. Called after saveEvent, saveRepetition,
 * incrementEventCounterAndAffectedUsers when USE_UNIFIED_EVENTS_COLLECTIONS=true.
 * Errors are logged in lib layer, don't throw.
 *
 * @see docs/mongodb-unified-collections/
 */

import type { Db, ObjectId } from 'mongodb';
import {
  insertEventUnified,
  insertRepetitionUnified,
  ensureEventAndIncrementUnified as ensureEventAndIncrementUnifiedLib,
} from '../../../../lib/db/unified';

/**
 * Write event to unified events collection (dual-write)
 */
export async function writeEventToUnified(
  db: Db,
  projectId: string,
  doc: Record<string, unknown>,
  insertedId: ObjectId
): Promise<void> {
  await insertEventUnified(db, projectId, doc, insertedId);
}

/**
 * Write repetition to unified repetitions collection (dual-write)
 */
export async function writeRepetitionToUnified(
  db: Db,
  projectId: string,
  doc: Record<string, unknown>,
  insertedId: ObjectId
): Promise<void> {
  await insertRepetitionUnified(db, projectId, doc, insertedId);
}

/**
 * Ensure event exists in unified collection (insert if missing), then increment counter.
 * Used when processing repetitions for events created before dual-write was enabled.
 */
export async function ensureEventAndIncrementUnified(
  db: Db,
  projectId: string,
  groupHash: string,
  eventDoc: Record<string, unknown>,
  incrementAffected: boolean
): Promise<void> {
  await ensureEventAndIncrementUnifiedLib(db, projectId, groupHash, eventDoc, incrementAffected);
}
