import {ObjectID} from 'mongodb';
import {Notify} from './notify';

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
  notify: Exclude<Notify, 'userId'>;
}
