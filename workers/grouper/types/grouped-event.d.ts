/**
 * Grouped event format
 */
import { EventData } from '../../../lib/types/hawk-event';
import { ObjectId } from 'mongodb';

export interface GroupedEvent {
  /**
   * Internal mongo id
   */
  _id: ObjectId;

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
}
