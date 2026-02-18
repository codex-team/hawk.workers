import * as pkg from './../package.json';
import WebhookProvider from './provider';
import SenderWorker from 'hawk-worker-sender/src';
import { ChannelType } from 'hawk-worker-notifier/types/channel';

/**
 * Worker to send webhook notifications
 */
export default class WebhookSenderWorker extends SenderWorker {
  /**
   * Worker type
   */
  public readonly type: string = pkg.workerType;

  /**
   * Webhook channel type
   */
  protected channelType = ChannelType.Webhook;

  /**
   * Webhook provider
   */
  protected provider = new WebhookProvider();
}
