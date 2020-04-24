import {TemplateEventData} from "../types/template-variables";
import {IncomingWebhookSendArguments} from "@slack/webhook";
import { block, element, object, TEXT_FORMAT_MRKDWN, TEXT_FORMAT_PLAIN } from 'slack-block-kit'

const { text } = object;
const { button } = element;
const { section, actions, divider, context } = block;

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
    const lastBacktrace = event.payload.backtrace.pop();

    const sourceLineMessages = [];
    for (const sourceCodeRow of lastBacktrace.sourceCode) {
      if (sourceCodeRow.line === lastBacktrace.line) {
        sourceLineMessages.push(sourceCodeRow.line + " -> " + sourceCodeRow.content);
      } else {
        sourceLineMessages.push(sourceCodeRow.line + ": " + sourceCodeRow.content);
      }
    }

    const blocks = [
      section(
        text(event.payload.title),
        TEXT_FORMAT_PLAIN
      ),
      context([
        text(`*At ${lastBacktrace.line} line*\n ${lastBacktrace.file}`, TEXT_FORMAT_MRKDWN)
      ]),
      context([
        text(`\`\`\`${sourceLineMessages}\`\`\``, TEXT_FORMAT_MRKDWN)
      ]),
      context([
        text(`\`${count} new \` ${event.totalCount} total ${daysRepeated} days repeating`, TEXT_FORMAT_MRKDWN)
      ]),
      divider(),
      actions([
        button('action', "Tete", {
          style: 'danger'
        })
      ])
    ];

    return blocks as IncomingWebhookSendArguments;
  }

  /**
   * @param digestVariables
   */
  public renderDigest(digestVariables: TemplateEventData[]): IncomingWebhookSendArguments
  {
    const blocks = [
      // 1 event
      context([
        text("You have 46 new events for the last 1 hour", TEXT_FORMAT_MRKDWN)
      ]),
      divider(),
      section(
        text("he request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission."),
        {
          accessory: button('action', 'Details', {})
        }
      ),

      // 2 event
      context([
        text(">class.AndropovVideo.js   |   12 new   348 total", TEXT_FORMAT_MRKDWN)
      ]),
      divider(),
      section(
        text("The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission."),
        {
          accessory: button('action', 'Details', {})
        }
      ),

      // 3 event
      context([
        text(">class.AndropovVideo.js   |   12 new   348 total", TEXT_FORMAT_MRKDWN)
      ]),
      divider(),
      section(
        text("The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission."),
        {
          accessory: button('action', 'Details', {})
        }
      ),

      // footer
      context([
        text(">class.AndropovVideo.js   |   12 new   348 total", TEXT_FORMAT_MRKDWN)
      ]),
      divider(),
      actions([
        button('action', 'and 41 more...', {
          style: 'danger'
        })
      ])
    ];

    return block as IncomingWebhookSendArguments;
  }
}
