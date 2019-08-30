import {ObjectId} from "bson";
import {BacktraceFrame, User} from "../../../lib/types/event-worker-task";

/**
 * Repetition is a document contained diff with original event
 */
export interface Repetition {
  /**
   * Internal mongo id
   */
  _id?: ObjectId;

  /**
   * Hash for grouping similar events
   */
  groupHash: string;

  /**
   * And any of EventData field with diff
   * except fields that used in groupHash
   *
   * @see {EventData}
   */
  timestamp?: number;
  backtrace?: BacktraceFrame[];
  get?: object;
  post?: object;
  headers?: object;
  release?: string;
  user?: User;
  context?: object;
}
