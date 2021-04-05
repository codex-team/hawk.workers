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

export interface SourceMapsEventWorkerTask {
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
