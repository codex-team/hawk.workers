import { ChannelType } from 'hawk-worker-notifier/types/channel';
import NotificationsProvider from './provider';
import EmailProvider from './providers/email/provider';
import TelegramProvider from './providers/telegram/provider';
import SlackProvider from './providers/slack/provider';
import WebhookProvider from './providers/webhook/provider';
import LoopProvider from './providers/loop/provider';

/**
 * Registry of notification channels and their providers
 */
const channelProviders: Record<ChannelType, new () => NotificationsProvider> = {
  [ChannelType.Email]: EmailProvider,
  [ChannelType.Telegram]: TelegramProvider,
  [ChannelType.Slack]: SlackProvider,
  [ChannelType.Webhook]: WebhookProvider,
  [ChannelType.Loop]: LoopProvider,
};

export default channelProviders;
