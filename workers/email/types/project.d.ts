import { ObjectID } from 'mongodb';
import { Rule } from '../../notifier/types/rule';

/**
 * Interface describes Hawk Project object
 */
export interface Project {
  _id: string | ObjectID;
  name: string;
  image?: string;
  notifications: Rule[];
}
