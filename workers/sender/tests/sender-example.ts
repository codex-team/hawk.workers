import SenderWorker from '../src';
import ExampleProvider from './provider-example';

/**
 * This class in an example implementation of the abstract Sender
 * Used in tests.
 *
 * Will send messages to the terminal console ->> mister ConsoleSender
 */
export default class ExampleSenderWorker extends SenderWorker {
  /**
   * Worker type
   */
  public readonly type: string = 'sender/example';

  /**
   * Email channel type
   */
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  protected channelType = 'console';

  /**
   * Email provider
   */
  protected provider = new ExampleProvider();
}
