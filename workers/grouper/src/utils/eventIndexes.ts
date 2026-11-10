import type { Db, IndexSpecification } from 'mongodb';

const NAMESPACE_NOT_FOUND = 26;

/**
 * Must match the indexes hawk.api.nodejs creates for a new project
 */
export const EVENT_COLLECTIONS_INDEXES: Record<string, IndexSpecification[]> = {
  events: [
    {
      key: { 'payload.release': 1 },
      name: 'payloadRelease',
      sparse: true,
    },
    {
      key: { groupHash: 1 },
      name: 'groupHashUnique',
      unique: true,
    },
    {
      key: { timestamp: 1 },
      name: 'timestamp',
      sparse: true,
    },
  ],
  repetitions: [
    {
      key: { groupHash: 'hashed' },
      name: 'groupHash_hashed',
    },
    {
      key: {
        groupHash: 1,
        release: 1,
      },
      name: 'groupHashAndRelease',
    },
    {
      key: { 'payload.user.id': 1 },
      name: 'userId',
      sparse: true,
    },
    {
      key: { timestamp: 1 },
      name: 'timestamp',
      sparse: true,
    },
  ],
  dailyEvents: [
    {
      key: { groupingTimestamp: 1 },
      name: 'groupingTimestamp',
    },
    {
      key: {
        groupingTimestamp: 1,
        groupHash: 1,
      },
      name: 'groupingTimestampAndGroupHash',
    },
    {
      key: {
        groupingTimestamp: -1,
        lastRepetitionTime: -1,
        _id: -1,
      },
      name: 'groupingTimestampAndLastRepetitionTimeAndId',
    },
    {
      key: { groupHash: 1 },
      name: 'groupHash',
    },
  ],
};

export interface EventIndexesReport {
  /**
   * Collections that did not exist and were created with indexes
   */
  created: string[];

  /**
   * Expected indexes absent in already existing collections
   */
  missing: string[];
}

/**
 * Creates missing event collections of a project with their indexes.
 * Existing collections are only compared with the expected set: building an index on live data is not a hot path job.
 *
 * @param db - events database
 * @param projectId - project to check
 */
export async function ensureEventIndexes(db: Db, projectId: string): Promise<EventIndexesReport> {
  const report: EventIndexesReport = {
    created: [],
    missing: [],
  };

  for (const [prefix, specs] of Object.entries(EVENT_COLLECTIONS_INDEXES)) {
    const collection = db.collection(`${prefix}:${projectId}`);
    const existing: IndexSpecification[] = await collection.indexes().catch((error) => {
      if (error.code !== NAMESPACE_NOT_FOUND) {
        throw error;
      }

      return [];
    });

    if (existing.length === 0) {
      await collection.createIndexes(specs);
      report.created.push(prefix);

      continue;
    }

    for (const spec of specs) {
      const found = existing.some((index) => {
        return JSON.stringify(index.key) === JSON.stringify(spec.key) && !!index.unique === !!spec.unique;
      });

      if (!found) {
        report.missing.push(`${prefix}.${spec.name}`);
      }
    }
  }

  return report;
}
