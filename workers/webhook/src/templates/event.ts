import type { EventsTemplateVariables, TemplateEventData } from 'hawk-worker-sender/types/template-variables';
import { WebhookPayload } from '../../types/template';

/**
 * Builds webhook JSON payload for a single event notification
 *
 * @param tplData - event template data
 */
export default function render(tplData: EventsTemplateVariables): WebhookPayload {
  const eventInfo = tplData.events[0] as TemplateEventData;
  const event = eventInfo.event;
  const eventURL = tplData.host + '/project/' + tplData.project._id + '/event/' + event._id + '/';

  let location: string | null = null;

  if (event.payload.backtrace && event.payload.backtrace.length > 0 && event.payload.backtrace[0].file) {
    location = event.payload.backtrace[0].file;
  }

  return {
    type: 'event',
    project: {
      id: tplData.project._id.toString(),
      name: tplData.project.name,
    },
    events: [
      {
        id: event._id.toString(),
        title: event.payload.title,
        newCount: eventInfo.newCount,
        totalCount: event.totalCount,
        url: eventURL,
        location,
        daysRepeated: eventInfo.daysRepeated,
      },
    ],
  };
}
