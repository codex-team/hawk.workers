import { ObjectId } from 'mongodb';
import { ProjectDBScheme } from 'hawk.types';

/**
 * Report data for specific project
 */
export interface ReportDataByProject {
  /**
   * Project data to report
   */
  project: ProjectDBScheme;

  /**
   * Number of archived events
   */
  archivedEventsCount: number;

  /**
   * Number of the removed releases
   */
  removedReleasesCount: number;
}

export interface ReportData {
  /**
   * Date when archiving started
   */
  startDate: Date;

  /**
   * Date when archiving finished
   */
  finishDate: Date;

  /**
   * Data about projects and archived events count
   */
  projectsData: ReportDataByProject[];

  /**
   * Database size when worker start archiving
   */
  dbSizeOnStart: number;

  /**
   * Database size when worker stop archiving
   */
  dbSizeOnFinish: number;
}

/**
 * Release record in database
 */
export interface ReleaseRecord {
  /**
   * Record id
   */
  _id: ObjectId;

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
  files: ReleaseFileData[];
}

/**
 * Release file in database
 */
export interface ReleaseFileData {
  /**
   * Name of source-map file
   *
   * @example main.min.js.map
   */
  mapFileName: string;

  /**
   * Bundle or chunk name
   *
   * @example main.min.js
   */
  originFileName: string;

  /**
   * Source map body in string.
   * After saving to the db, this field will be removed, and _id of saved file will be added instead
   */
  content?: string;

  /**
   * When file will be saved to GridFS, there will be its id instead of 'content'
   */
  _id?: ObjectId;
}
