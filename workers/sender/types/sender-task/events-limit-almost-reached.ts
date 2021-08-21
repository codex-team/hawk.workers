/**
 * Payload for task when events limit is almost reached
 */
export interface SenderWorkerEventsLimitAlmostReachedPayload {
  /**
   * Target workspace id
   */
  workspaceId: string;

  /**
   * Number of events Hawk got
   */
  eventsCount: number;

  /**
   * Number of events allowed by plan
   */
  eventsLimit: number;
}

/**
 * Payload of an event when events limit is almost reached
 */
export interface SenderWorkerEventsLimitAlmostReachedTask {
  /**
   * Task name
   */
  type: 'events-limit-almost-reached',

  /**
   * Payload data
   */
  payload: SenderWorkerEventsLimitAlmostReachedPayload
}
