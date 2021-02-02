/* eslint-disable */
import NotificationsProvider from '../src/provider';
import { Notification } from '../types/template-variables';

/**
 * Example implementation of abstract provider
 */
export default class ExampleProvider extends NotificationsProvider {
  /**
   * Send method example
   *
   * @param to - endpoint
   * @param notification - notification to send
   */
  public async send(to: string, notification: Notification): Promise<void> {
    console.log(`ExampleProvider: sending to ${to} ... `);
  }
}
