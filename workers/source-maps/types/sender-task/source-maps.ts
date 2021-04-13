export interface SourcemapCollectedData {
  /**
   * Bundle or chunk name
   */
  name: string;

  /**
   * Source map body
   */
  payload: string;
}

export interface ReleaseWorkerSourceMapsPayload {
  /**
   * Project that sends the source map
   */
  projectId: string;

  /**
   * Bundle version for this source map
   */
  release: string;

  /**
   * List of source maps for all chunks
   */
  files: SourcemapCollectedData[];
}

/**
 * Payload of an event assigning someone to resolve the issue (event)
 */
export interface ReleaseWorkerSourceMapsTask {
  type: 'source-maps',
  payload: ReleaseWorkerSourceMapsPayload
}