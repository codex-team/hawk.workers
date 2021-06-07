import { SourceMapDataExtended } from 'hawk.types';

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
  files: SourceMapDataExtended[];
}