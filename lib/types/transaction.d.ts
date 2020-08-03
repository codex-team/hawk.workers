import { ObjectId } from 'mongodb';

/**
 * Model representing transaction object
 *
 * @typedef {object} Transaction
 * @property {string} id - transaction id
 * @property {string} type - transaction type ('income' or 'charge')
 * @property {number} amount - transaction amount
 * @property {Workspace} workspace - workspace for which transaction has been proceed
 * @property {number} date - transaction date
 * @property {User} user - user by whom transaction has been made (income transactions only)
 * @property {number} cardPan - PAN of card by which transaction was made (income transactions only)
 */

export default interface Transaction {
  _id: ObjectId;
  type: string;
  amount: number;
  workspace: ObjectId;
  user: ObjectId;
  date: Date;
  cardPan?: string;
}
