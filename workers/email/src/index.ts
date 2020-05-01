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
   * Constructor uses to check required ENV params
   */
  constructor() {
    super();

    if (!process.env.GARAGE_URL){
      throw Error('procces.env.GARAGE_URL does not specified')
    }

    if (!process.env.API_STATIC_URL){
      throw Error('procces.env.API_STATIC_URL does not specified')
    }
  }

  /**
   * Email provider
   */
  protected provider = new EmailProvider();
}
