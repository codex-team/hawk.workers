import type { EventsTemplateVariables, TemplateEventData } from 'hawk-worker-sender/types/template-variables';

/**
 * Escape characters that break Telegram legacy Markdown parsing
 *
 * @param text - raw text
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/[_*`[]/g, '\\$&');
}

/**
 * Return tpl with data substitutions
 *
 * @param tplData - event template data
 */
export default function render(tplData: EventsTemplateVariables): string {
  const eventInfo = tplData.events[0] as TemplateEventData;
  const event = eventInfo.event;
  const repetitionId = eventInfo.repetitionId;
  const eventURL = tplData.host + '/project/' + tplData.project._id + '/event/' + event._id + '/' + (repetitionId ? repetitionId + '/overview' : '');
  let location = '';

  if (event.payload.backtrace && event.payload.backtrace.length > 0) {
    location = event.payload.backtrace[0].file || 'Unknown location';
    location = '\n' + '```\n' + location + '\n```'; // markdown code block
  }

  return ''.concat(escapeMarkdown(event.payload.title),
    '\n',
    location || '',
    '\n',
    `[View details](${eventURL}) `, `| ${escapeMarkdown(tplData.project.name)}`, ` | ${eventInfo.newCount} new (${eventInfo.event.totalCount} total)`
  );
}
