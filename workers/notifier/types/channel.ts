/**
 * Possible channel types
 */
export enum ChannelType {
  Email = 'email',
  Telegram = 'telegram',
  Slack = 'slack',
  Loop = 'loop',
}

/**
 * Composed key to identify channel
 *
 * [projectId, ruleId, channelName]
 */
export type ChannelKey = [string, string, string];

/**
 * Composed key to identify event
 *
 * [projectId, ruleId, channelName, eventGroupHash]
 */
export type EventKey = [string, string, string, string];

/**
 * Interface that represents data, that notifier passes to sender worker
 */
export interface SenderData {
  /**
   * Group hash of the event
   */
  key: string;

  /**
   * Number of events received
   */
  count: number;

  /**
   * ID of the repetition that triggered this notification
   * null for first occurrence, ObjectId string for repetitions
   */
  repetitionId: string | null;
}

/**
 * Notification channel object
 */
export interface Channel {
  /**
   * Shows if channel is enabled
   */
  readonly isEnabled: boolean;

  /**
   * Channel endpoint
   */
  readonly endpoint: string;

  /**
   * Minimum period of time should pass between two messages in seconds
   */
  readonly minPeriod: number;
}
