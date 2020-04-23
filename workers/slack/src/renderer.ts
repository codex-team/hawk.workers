import {TemplateEventData} from "../types/template-variables";
import {IncomingWebhookSendArguments} from "@slack/webhook";
import {Section} from "./renderer/section";
import {Builder} from "./renderer/builder";
const Templater = require('json-templater/object');

/**
 * Renderer class
 * Renders JSON template and
 */
export class Renderer {
  /**
   * Returns JSON template
   *
   * @param {TemplateEventData}
   *
   * @return {IncomingWebhookSendArguments}
   */
  public renderNewEvent({ event, daysRepeated, count }: TemplateEventData): IncomingWebhookSendArguments {
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
        daysRepeating: daysRepeated,
        newCount: count
      }
    );
  }

  /**
   * @param digestVariables
   */
  public renderDigest(digestVariables: TemplateEventData[])
  {
    const builder = new Builder();

    const section = new Section();
    builder.addBlock(section);
    builder.buildMessage();
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
