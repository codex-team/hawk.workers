import * as pkg from '../package.json';
import './env';
import EmailProvider from './provider';
import SenderWorker from 'hawk-worker-sender/src';
import { ChannelType } from 'hawk-worker-notifier/types/channel';

/**
 * Worker to send email notifications
 */
export default class EmailSenderWorker extends SenderWorker {
  /**
   * Worker type
   */
  public readonly type: string = pkg.workerType;

  /**
   * Email channel type
   */
  protected channelType = ChannelType.Email;

  /**
   * Email provider
   */
  protected provider = new EmailProvider();
}
