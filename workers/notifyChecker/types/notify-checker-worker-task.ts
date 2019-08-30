import {GroupedEvent} from "../../grouper/types/grouped-event";

export enum notifyTypes {
  EVENT = "event",
  MERCHANT = "merchant",
}

export interface NotifyCheckerWorkerTaskPayloadGrouper extends Pick<GroupedEvent, "catcherType" | "payload"> {
  /**
   * Event project ID
   */
  projectId: string;

  /**
   * Is event new
   */
  new: boolean;
}

export interface NotifyCheckerWorkerTaskPayloadMerchant {
  /**
   * Transaction amount in kopecs
   */
  amount: number;

  /**
   * User ID
   */
  userId: string;

  /**
   * Workspace ID
   */
  workspaceId: string;

  /**
   * Timestamp
   */
  timestamp: number;
}

export interface NotifyCheckerWorkerTask {
  /**
   * Task type
   */
  type: notifyTypes;

  /**
   * Task payload. Type-specific
   */
  payload: NotifyCheckerWorkerTaskPayloadGrouper | NotifyCheckerWorkerTaskPayloadMerchant;
}
