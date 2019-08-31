export interface SourceMapsRecord {
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
  files: SourcemapDataExtended[],
}

export interface SourcemapDataExtended {
  /**
   * Name of source-map file
   * @example main.min.js.map
   */
  mapFileName: string;

  /**
   * Bundle or chunk name
   * @example main.min.js
   */
  originFileName: string;

  /**
   * Source map body
   */
  content: string;
}
