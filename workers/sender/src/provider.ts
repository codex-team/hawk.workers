import { Logger } from 'winston';
import { TemplateVariables } from '../types/template-variables';

/**
 * Abstract class that describes notification provider
 */
export default abstract class NotificationsProvider {
  /**
   * Winston logger instance
   */
  protected logger: Logger;

  /**
   * Provider constructor
   *
   * @class
   * @param logger - winston logger
   */
  constructor(logger: Logger) {
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
  public abstract async send(endpoint: string, variables: TemplateVariables): Promise<void>;
}
