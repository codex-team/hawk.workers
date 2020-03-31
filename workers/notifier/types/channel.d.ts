/**
 * Possible channel types
 */
export enum ChannelType {
  Email = 'email',
  Telegram = 'telegram',
  Slack = 'slack',
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
  readonly endpoint?: string;

  /**
   * Minimum period of time should pass between two messages
   */
  readonly minPeriod?: number;
}
