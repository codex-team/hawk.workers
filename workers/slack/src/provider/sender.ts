import {IncomingWebhookSendArguments} from "@slack/webhook";

/**
 * Slack sender provider interface
 */
export interface Sender {
  /**
   * @param {string} url
   * @param {string|IncomingWebhookSendArguments} message
   */
  send(url: string, message: string | IncomingWebhookSendArguments): void
}
