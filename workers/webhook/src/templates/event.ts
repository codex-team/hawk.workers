import type { EventsTemplateVariables, TemplateEventData } from 'hawk-worker-sender/types/template-variables';

/**
 * Builds webhook JSON payload for a single event notification.
 * Mirrors the same data structure other workers receive, serialized as JSON.
 *
 * @param tplData - event template data
 */
export default function render(tplData: EventsTemplateVariables): Record<string, unknown> {
  const eventInfo = tplData.events[0] as TemplateEventData;
  const event = eventInfo.event;
  const eventURL = tplData.host + '/project/' + tplData.project._id + '/event/' + event._id + '/';

  return {
    project: {
      id: tplData.project._id.toString(),
      name: tplData.project.name,
    },
    event: {
      id: event._id?.toString() ?? null,
      groupHash: event.groupHash,
      totalCount: event.totalCount,
      newCount: eventInfo.newCount,
      daysRepeated: eventInfo.daysRepeated,
      url: eventURL,
      payload: event.payload,
    },
    period: tplData.period,
  };
}
