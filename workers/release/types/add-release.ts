import { SourcemapCollectedData } from 'hawk.types';

/**
 * Git commit data needed to create a release
 */
export interface CommitDataUnparsed {
  /**
   * Commit hash
   *
   * @example 599575d00e62924d08b031defe0a6b10133a75fc
   */
  hash: string;

  /**
   * Title of the commit
   *
   * @example Hot fix
   */
  title: string;

  /**
   * Commit author
   *
   * @example codex-team@codex.so
   */
  author: string;

  /**
   * Commit date in string format
   *
   * @example Wed Apr 7 15:02:40 2021 +0300
   */
  date: string;
}

/**
 * Payload for a worker task
 */
export interface ReleaseWorkerAddReleasePayload {
  /**
   * Release id: custom release name
   *
   * @example Version 1.1.0
   */
  release: string;

  /**
   * Commits data in JSON
   */
  commits: CommitDataUnparsed[];

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