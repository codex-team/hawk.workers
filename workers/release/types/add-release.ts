import { SourcemapCollectedData } from './source-maps-record';

/**
 * Git commit data needed to create a release
 */
export interface CommitData {
  /**
   * Commit hash
   */
  hash: string;

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
   * Release id: custom release name
   */
  release: string;

  /**
   * Commits data in JSON
   */
  commits: CommitData[];

  /**
   * Type of a catcher to identify a sourceMaps handler
   */
  catcherType: string;

  /**
   * List of source maps for all chunks
   */
  files?: SourcemapCollectedData[];
}

/**
 * Worker task for adding a new release
 */
export interface ReleaseWorkerAddReleaseTask {
  /**
   * Project id
   */
  projectId: string;

  /**
   * Task type for distribution to handlers
   */
  type: 'add-release';

  /**
   * Task payload for processing
   */
  payload: ReleaseWorkerAddReleasePayload
}