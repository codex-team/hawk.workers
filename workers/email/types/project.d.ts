import { ObjectID } from 'mongodb';

/**
 * Interface describes Hawk Project object
 */
export interface Project {
  _id: string | ObjectID;
  name: string;
  image?: string;
}
