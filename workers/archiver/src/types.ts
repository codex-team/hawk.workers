import { ObjectId } from 'mongodb';

/**
 * Project representation
 */
export interface Project {
  /**
   * Project id
   */
  _id: ObjectId;

  /**
   * Project name
   */
  name: string;
}

/**
 * Report data for specific project
 */
export interface ReportDataByProject {
  /**
   * Project data to report
   */
  project: Project;

  /**
   * Number of archived events
   */
  archivedEventsCount: number;
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
}
