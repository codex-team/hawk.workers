import { EventsTemplateVariables } from 'hawk-worker-sender/types/template-variables';
import { GroupedEventDBScheme, ProjectDBScheme } from 'hawk.types';
import { ObjectId } from 'mongodb';

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
      } as GroupedEventDBScheme,
      daysRepeated: 1,
      newCount: 1,
    },
  ],
  period: 60,
  host: process.env.GARAGE_URL,
  hostOfStatic: process.env.API_STATIC_URL,
  project: {
    _id: new ObjectId('projectId'),
    token: 'project-token',
    name: 'Project',
    workspaceId: new ObjectId('workspace-id'),
    uidAdded: new ObjectId('used-id'),
    notifications: [],
  } as ProjectDBScheme,
} as EventsTemplateVariables;
