import { ObjectId } from 'mongodb';

/**
 * Release data used during validation.
 */
export interface ReleaseRecord {
  _id: ObjectId;
  projectId: string;
  release: string;
  fixChecked?: boolean;
}

/**
 * Original event data used during validation.
 */
export interface EventRecord {
  _id: ObjectId;
  groupHash: string;
  payload?: {
    release?: string;
  };
  resolvedInRelease?: string | null;
}

/**
 * Repetition data used during validation.
 */
export interface RepetitionRecord {
  groupHash: string;
  release?: string;
}
