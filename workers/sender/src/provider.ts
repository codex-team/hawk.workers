import { Logger } from 'winston';
import { Notification } from 'hawk-worker-sender/types/template-variables/';

/**
 * Abstract class that describes notification provider
 */
export default abstract class NotificationsProvider {
  /**
   * Winston logger instance
   */
  public logger: Logger;

  /**
   * Set logger instance
   *
   * @param logger - winston logger
   */
  public setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Method to send notification
   *
   * @abstract
   *
   * @param endpoint - endpoint where to send notification
   * @param variables - notification variables
   */
  public abstract async send(endpoint: string, variables: Notification): Promise<void>;
}
