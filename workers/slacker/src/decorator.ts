import {IncomingWebhook, IncomingWebhookSendArguments} from "@slack/webhook";

/**
 * Decorator
 */
export default class Decorator {
  /**
   * Sends message via IncomingWebhook SDK
   * @param {string} url - channel webhook
   * @param {string|IncomingWebhookSendArguments} message - sending message in Slack API format
   */
  public async send(url :string, message: string | IncomingWebhookSendArguments): Promise<void> {
    // initialize incoming webhook
    const webhook = new IncomingWebhook(url);

    await webhook.send(message);
  }
}
