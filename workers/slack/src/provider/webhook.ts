import {IncomingWebhook, IncomingWebhookSendArguments} from "@slack/webhook";
import {Sender} from "./sender";

/**
 * Slack incoming webhook sender
 * @see https://api.slack.com/messaging/webhooks
 */
export default class WebhookSender implements Sender {
  /**
   * Sends message via IncomingWebhook SDK
   *
   * @param {string} url - channel webhook
   * @param {string|IncomingWebhookSendArguments} message - sending message in Slack API format
   */
  public async send(url: string, message: string | IncomingWebhookSendArguments): Promise<void> {
    const webhook = new IncomingWebhook(url);
    await webhook.send(message);
  }
}
