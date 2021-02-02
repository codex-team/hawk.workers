export interface SenderWorkerAssigneePayload {
  /**
   * ID of the user assigned to this event
   */
  assigneeId: string;

  /**
   * Project event related to
   */
  projectId: string;

  /**
   * Event id
   */
  eventId: string;

  /**
   * Id of the user who assigned this person
   */
  whoAssignedId: string;

  /**
   * Notification endpoint
   */
  endpoint: string;
}

/**
 * Payload of an event assigning someone to resolve the issue (event)
 */
export interface SenderWorkerAssigneeTask {
  type: 'assignee',
  payload: SenderWorkerAssigneePayload
}