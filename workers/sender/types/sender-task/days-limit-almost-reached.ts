/**
 * Payload for task when days limit is almost reached
 */
export interface SenderWorkerDaysLimitAlmostReachedPayload {
  /**
   * Target workspace id
   */
  workspaceId: string;

  /**
   * Number of days left
   */
  daysLeft: number;
}

/**
 * Payload of an event when days limit is almost reached
 */
export interface SenderWorkerDaysLimitAlmostReachedTask {
  /**
   * Task name
   */
  type: 'days-limit-almost-reached',

  /**
   * Payload data
   */
  payload: SenderWorkerDaysLimitAlmostReachedPayload
}
