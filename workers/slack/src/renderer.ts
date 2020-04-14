import {GroupedEvent} from "hawk-worker-grouper/types/grouped-event";
import {IncomingWebhookSendArguments} from "@slack/webhook";
const Templater = require('json-templater/object');

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
   * @param {number} daysRepeating
   * @param {number} newCount
   * @param {number} type - type of event to define template
   *
   * @return {IncomingWebhookSendArguments}
   */
  public render(
    event: GroupedEvent,
    daysRepeating: number,
    newCount: number,
    type: number
  ): IncomingWebhookSendArguments {
    let template = {};

    switch (type) {
      case EventTypes.NEW:
        template = this.processNewEvent(event, daysRepeating, newCount);
        break;
    }

    return template;
  }

  /**
   * Gets template and replaces default value
   *
   * @param {GroupedEvent} event
   * @param {number} daysRepeating
   * @param {number} newCount
   *
   * @return {IncomingWebhookSendArguments}
   */
  private processNewEvent(
    event: GroupedEvent,
    daysRepeating: number,
    newCount: number
  ): IncomingWebhookSendArguments {
    const template = this.getTemplate('new-event');
    const lastBacktrace = event.payload.backtrace.pop();

    const sourceLineMessages = [];
    for (const sourceCodeRow of lastBacktrace.sourceCode) {
      if (sourceCodeRow.line === lastBacktrace.line) {
        sourceLineMessages.push(sourceCodeRow.line + " -> " + sourceCodeRow.content);
      } else {
        sourceLineMessages.push(sourceCodeRow.line + ": " + sourceCodeRow.content);
      }
    }

    return Templater(
      template,
      {
        title: event.payload.title,
        line: lastBacktrace.line,
        file: lastBacktrace.file,
        sourceMessage: sourceLineMessages.join("\n"),
        totalCount: event.totalCount,
        daysRepeating: daysRepeating,
        newCount: newCount
      }
    );
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
