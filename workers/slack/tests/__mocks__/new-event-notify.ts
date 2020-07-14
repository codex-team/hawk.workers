import { EventsTemplateVariables } from 'hawk-worker-sender/types/template-variables';
import { GroupedEvent } from 'hawk-worker-grouper/types/grouped-event';
import { Project } from 'hawk-worker-sender/types/project';

/**
 * Example of new-events notify template variables
 */
export default {
  events: [
    {
      event: {
        totalCount: 10,
        payload: {
          title: 'New event',
          timestamp: Date.now(),
          backtrace: [ {
            file: 'file',
            line: 1,
            sourceCode: [ {
              line: 1,
              content: 'code',
            } ],
          } ],
        },
      } as GroupedEvent,
      daysRepeated: 1,
      newCount: 1,
    },
  ],
  period: 60,
  host: process.env.GARAGE_URL,
  hostOfStatic: process.env.API_STATIC_URL,
  project: {
    _id: 'projectId',
    name: 'Project',
    notifications: [],
  } as Project,
} as EventsTemplateVariables;
