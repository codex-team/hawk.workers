import { SourcemapCollectedData } from './source-maps';

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
   * Author
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
   * ID of the release
   */
  releaseId: string;

  /**
   * Commits data
   */
  commits: CommitData[];

  /**
   * List of source maps for all chunks
   */
  sourceMaps: SourcemapCollectedData[];
}

/**
 * Payload of an event assigning someone to resolve the issue (event)
 */
export interface ReleaseWorkerAddReleaseTask {
  type: 'add-release',
  payload: ReleaseWorkerAddReleasePayload
}