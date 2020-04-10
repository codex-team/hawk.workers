import {GroupedEvent} from "hawk-worker-grouper/types/grouped-event";
import {IncomingWebhookSendArguments} from "@slack/webhook";

/**
 * Event types
 * Renderer defines template according to this value
 */
export enum EventTypes {
  NEW,
}

/**
 * Renderer class
 * Renders JSON template and
 */
export class Renderer {
  /**
   * Returns JSON template
   *
   * @param {GroupedEvent} event
   * @param {number} type - type of event to define template
   *
   * @return {IncomingWebhookSendArguments}
   */
  public render(event: GroupedEvent, type: number): IncomingWebhookSendArguments {
    let template = {};

    switch (type) {
      case EventTypes.NEW:
        template = this.processNewEvent(event);
        break;
    }

    return template;
  }

  /**
   * Gets template and replaces default value
   *
   * @param {GroupedEvent} event
   *
   * @return {IncomingWebhookSendArguments}
   */
  private processNewEvent(event: GroupedEvent): IncomingWebhookSendArguments {
    const template = this.getTemplate('new-event');

    template.text = "New Error";
    template.attachments[0].text = event.payload.title;
    return template;
  }

  /**
   * Returns JSON template of prepared message
   * @param {string} name - template name
   */
  private getTemplate(name: string): IncomingWebhookSendArguments
  {
    return require(`./templates/${name}.json`);
  }
}
