import type { EventsTemplateVariables } from 'hawk-worker-sender/types/template-variables';
import { WebhookPayload } from '../../types/template';

/**
 * Builds webhook JSON payload for a several-events notification
 *
 * @param tplData - event template data
 */
export default function render(tplData: EventsTemplateVariables): WebhookPayload {
  const projectUrl = tplData.host + '/project/' + tplData.project._id;

  return {
    type: 'several-events',
    project: {
      id: tplData.project._id.toString(),
      name: tplData.project.name,
      url: projectUrl,
    },
    events: tplData.events.map(({ event, newCount, daysRepeated }) => {
      const eventURL = tplData.host + '/project/' + tplData.project._id + '/event/' + event._id + '/';

      let location: string | null = null;

      if (event.payload.backtrace && event.payload.backtrace.length > 0 && event.payload.backtrace[0].file) {
        location = event.payload.backtrace[0].file;
      }

      return {
        id: event._id.toString(),
        title: event.payload.title,
        newCount,
        totalCount: event.totalCount,
        url: eventURL,
        location,
        daysRepeated,
      };
    }),
    period: tplData.period,
  };
}
