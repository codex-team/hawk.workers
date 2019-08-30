export interface NotifySlackWorkerTask {
  /**
   * Incoming webhook URL
   */
  hook: string;

  /**
   * Text to send
   */
  text: string;
}
