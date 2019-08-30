export interface NotifyEmailWorkerTask {
  /**
   * Recipient email
   */
  to: string;

  /**
   * Email subject
   */
  subject: string;

  /**
   * Email text
   */
  text: string;

  /**
   * Email html content
   */
  html: string;

}
