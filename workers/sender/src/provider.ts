import { Logger } from 'winston';
import { AllNotifications } from '../types/template-variables';

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
  public abstract async send(endpoint: string, variables: AllNotifications): Promise<void>;
}
