import {ObjectID} from "mongodb";

export interface Project {
  /**
   * Project ID
   */
  _id: ObjectID | string;

  /**
   * Project name
   */
  name: string;
}
