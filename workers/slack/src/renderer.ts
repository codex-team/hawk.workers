import {GroupedEvent} from "hawk-worker-grouper/types/grouped-event";
import {IncomingWebhookSendArguments} from "@slack/webhook";

/**
 * Renderer class
 */
export class Renderer {
  /**
   * @param event
   */
  public render(event: GroupedEvent): IncomingWebhookSendArguments {
    const template = this.getTemplate('new-event');
    template.text = "New Error";
    template.attachments[0].text = event.payload.title;

    return template;
  }

  /**
   * @param name
   */
  private getTemplate(name: string): IncomingWebhookSendArguments
  {
    return require('./templates/new-event.json');
  }
}
