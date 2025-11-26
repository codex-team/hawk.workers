import { GroupedEventDBScheme } from '@hawk.so/types';
import type { EventsTemplateVariables, TemplateEventData } from 'hawk-worker-sender/types/template-variables';
import { toMaxLen } from '../../../slack/src/templates/utils';

/**
 * Renders backtrace overview
 *
 * @param event - event to render
 */
function renderBacktrace(event: GroupedEventDBScheme): string {
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

    const MAX_SOURCE_CODE_LINE_LENGTH = 65;

    return `${line}${colDelimiter}  ${toMaxLen(content, MAX_SOURCE_CODE_LINE_LENGTH)}`;
  }).join('\n');

  return code;
}

/**
 * Return tpl with data substitutions
 *
 * @param tplData - event template data
 */
export default function render(tplData: EventsTemplateVariables): string {
  const eventInfo = tplData.events[0] as TemplateEventData;
  const event = eventInfo.event;
  const eventURL = tplData.host + '/project/' + tplData.project._id + '/event/' + event._id + '/';
  let location = 'Неизвестное место';

  if (event.payload.backtrace && event.payload.backtrace.length > 0) {
    location = event.payload.backtrace[0].file;
  }

  return ''.concat(
    `**${event.payload.title}**`,
    '\n',
    `*${location}*\n`,
    '```\n' + renderBacktrace(event) + '\n```',
    '\n',
    `[Посмотреть подробности](${eventURL}) `, `| *${tplData.project.name}*`, ` | ${eventInfo.newCount} новых (${eventInfo.event.totalCount} всего)`
  );
}
