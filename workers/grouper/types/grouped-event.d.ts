/**
 * Grouped event format
 */
import {EventData} from '../../../lib/types/event-worker-task';
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
  count: number;

  /**
   * Error language type
   */
  catcherType: string;

  /**
   * Event data
   */
  payload: EventData;
}
