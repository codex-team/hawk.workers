/**
 * Payload for task when days limit is almost reached
 */
export interface SenderWorkerDaysLimitReachedPayload {
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
export interface SenderWorkerDaysLimitReachedTask {
  /**
   * Task name
   */
  type: 'days-limit-reached',

  /**
   * Payload data
   */
  payload: SenderWorkerDaysLimitReachedPayload
}
