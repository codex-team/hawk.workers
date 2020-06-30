import { EventsTemplateVariables, TemplateEventData } from 'hawk-worker-sender/types/template-variables';
import { IncomingWebhookSendArguments } from '@slack/webhook';
import { block, element, object, TEXT_FORMAT_MRKDWN, TEXT_FORMAT_PLAIN } from 'slack-block-kit';
import { GroupedEvent } from 'hawk-worker-grouper/types/grouped-event';

const { text } = object;
const { button } = element;
const { section, actions, divider, context } = block;

/**
 * Returns JSON with data substitutions
 *
 * @param tplData - event template data
 */
export default function render(tplData: EventsTemplateVariables): IncomingWebhookSendArguments {
  const eventInfo = tplData.events[0] as TemplateEventData;
  const event = eventInfo.event;
  const eventURL = tplData.host + '/project/' + tplData.project._id + '/event/' + event._id + '/';
  let location = '';

  if (event.payload.backtrace && event.payload.backtrace.length > 0) {
    location = event.payload.backtrace[0].file || (event.payload.addons.url as string) || 'Unknown location';
  }

  const blocks = [
    section(
      text(event.payload.title),
      TEXT_FORMAT_PLAIN
    ),
    context([
      text(`${location}`),
    ]),
    context([
      text(`\`\`\`${renderBacktrace(event)}\`\`\``, TEXT_FORMAT_MRKDWN),
    ]),
    context([
      text(`*${eventInfo.newCount} new*   ${event.totalCount} total`, TEXT_FORMAT_MRKDWN),
    ]),
    divider(),
    actions([
      button('action', 'View event', {
        style: 'danger',
        url: eventURL,
      }),
    ]),
  ];

  return {
    blocks,
  };
};

/**
 * Renders backtrace overview
 *
 * @param event - event to render
 */
function renderBacktrace(event: GroupedEvent): string {
  let code = '';

  const firstNotEmptyFrame = event.payload.backtrace.find(frame => !!frame.sourceCode);

  if (!firstNotEmptyFrame) {
    return code;
  }

  code = firstNotEmptyFrame.sourceCode.map(({ line, content }) => {
    let colDelimiter = ':  ';

    if (line === firstNotEmptyFrame.line) {
      colDelimiter = ' ->';
    }

    return `${line}${colDelimiter}  ${toMaxLen(content, 65)}`;
  }).join('\n');

  return code;
}

/**
 * Trim string to max length
 *
 * @param str - string to trim
 * @param len - max length
 */
function toMaxLen(str: string, len = 50): string {
  if (str.length <= len) {
    return str;
  }

  return str.substr(0, len) + '…';
}
