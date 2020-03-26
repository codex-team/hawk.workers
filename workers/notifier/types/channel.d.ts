export enum ChannelType {
  Email = 'email',
  Telegram = 'telegram',
  Slack = 'slack',
}

export interface Channel {
  readonly isEnabled: boolean;
  readonly endpoint?: string;
  readonly minPeriod?: number;
}
