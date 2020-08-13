import { ObjectId } from 'mongodb';

/**
 * Workspace representation in DataBase
 */
interface Workspace {
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

  /**
   * Workspace account id in accounting system
   */
  accountId: string;

  /**
   * Tariff plan of workspace
   */
  tariffPlanId: ObjectId;

  /**
   * Date when workspace was charged last time
   */
  lastChargeDate: Date;
}

export default Workspace;
