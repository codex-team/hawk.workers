import * as pkg from '../package.json';
import TelegramProvider from './provider';
import SenderWorker from 'hawk-worker-sender/src';
import { ChannelType } from 'hawk-worker-notifier/types/channel';

/**
 * Worker to send email notifications
 */
export default class TelegramSenderWorker extends SenderWorker {
  /**
   * Worker type
   */
  public readonly type: string = pkg.workerType;

  /**
   * Email channel type
   */
  protected channelType = ChannelType.Telegram;

  /**
   * Email provider
   */
  protected provider = new TelegramProvider();
}
