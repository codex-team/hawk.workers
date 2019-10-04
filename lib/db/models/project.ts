import { ObjectID } from 'mongodb';
import { NotifySettings } from './notify';

/**
 * Project model representation
 */
export interface Project {
  /**
   * Project ID
   */
  _id: ObjectID | string;

  /**
   * Integration token
   */
  token: string;

  /**
   * Project name
   */
  name: string;

  /**
   * Project description
   */
  description: string;

  /**
   * Project notify settings
   */
  notify: Exclude<NotifySettings, 'userId'>;
}
