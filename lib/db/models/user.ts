import {ObjectID} from 'mongodb';

export interface User {
  /**
   * Project ID
   */
  _id: ObjectID | string;

  /**
   * User email
   */
  email: string;

  /**
   * User name
   */
  name: string;

  /**
   * User image URL
   */
  image: string;
}
