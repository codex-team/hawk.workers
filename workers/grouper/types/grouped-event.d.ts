/**
 * Grouped event format
 */
import { ObjectId } from 'mongodb';
import { EventData } from '../../../lib/types/event-worker-task';

export interface GroupedEvent {
  /**
   * Internal mongo id
   */
  _id?: ObjectId;

  /**
   * Hash for grouping similar events
   */
  groupHash: string;

  /**
   * Number of events repetitions
   */
  totalCount: number;

  /**
   * Error language type
   */
  catcherType: string;

  /**
   * Event data
   */
  payload: EventData;

  /**
   * How many users catch this error
   */
  usersAffected: number;
}
