import type { EventsTemplateVariables } from 'hawk-worker-sender/types/template-variables';

/**
 * Builds webhook JSON payload for a several-events notification.
 * Mirrors the same data structure other workers receive, serialized as JSON.
 *
 * @param tplData - event template data
 */
export default function render(tplData: EventsTemplateVariables): Record<string, unknown> {
  const projectUrl = tplData.host + '/project/' + tplData.project._id;

  return {
    project: {
      id: tplData.project._id.toString(),
      name: tplData.project.name,
      url: projectUrl,
    },
    events: tplData.events.map(({ event, newCount, daysRepeated }) => {
      const eventURL = tplData.host + '/project/' + tplData.project._id + '/event/' + event._id + '/';

      return {
        id: event._id?.toString() ?? null,
        groupHash: event.groupHash,
        totalCount: event.totalCount,
        newCount,
        daysRepeated,
        url: eventURL,
        payload: event.payload,
      };
    }),
    period: tplData.period,
  };
}
