import { ObjectId } from 'mongodb';

/**
 * Workspace representation in DataBase
 */
interface WorkspaceDBScheme {
  /**
   * Workspace's id
   */
  _id: ObjectId;

  /**
   * Workspace's name
   */
  name: string;

  /**
   * Workspace's description
   */
  description?: string;

  /**
   * Workspace's image URL
   */
  image?: string;

  /**
   * Workspace balance
   */
  balance: number;

  tariffPlanId: ObjectId;

  lastChargeDate: Date;
}

export default WorkspaceDBScheme;
