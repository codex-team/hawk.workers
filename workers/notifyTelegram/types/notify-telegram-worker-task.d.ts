/**
 * Message parse modes
 */
export enum parseModes {
  MARKDOWN= "Markdown",
  HTML = "HTML"
}

export interface NotifyTelegramWorkerTask {
  /**
   * Telegram CodeX Bot hook URL
   */
  hook: string;

  /**
   * Message to send
   */
  message: string;

  /**
   * Message parse mode
   */
  parseMode: parseModes;
}
