import { SourcemapCollectedData } from './source-maps-record';

/**
 * Git commit data needed to create a release
 */
export interface CommitData {
  /**
   * Commit hash
   */
  commitHash: string;

  /**
   * Title of the commit
   */
  title: string;

  /**
   * Commit author
   */
  author: string;

  /**
   * Commit date
   */
  date: string;
}

/**
 * Payload for a worker task
 */
export interface ReleaseWorkerAddReleasePayload {
  /**
   * Project id
   */
  projectId: string;

  /**
   * Release id: custom release name
   */
  release: string;

  /**
   * Commits data
   */
  commits: CommitData[];

  /**
   * List of source maps for all chunks
   */
  files?: SourcemapCollectedData[];
}

/**
 * Worker task for adding a new release
 */
export interface ReleaseWorkerAddReleaseTask {
  type: 'add-release',
  payload: ReleaseWorkerAddReleasePayload
}