import { EventsTemplateVariables, EventNotification, NotificationTypes } from 'hawk-worker-sender/types/template-variables';
import { GroupedEventDBScheme, ProjectDBScheme } from 'hawk.types';
import { ObjectId } from 'mongodb';

/**
 * Example of new-events notify template variables
 */
export default {
  type: NotificationTypes.EVENT,
  payload: {
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
        },
        daysRepeated: 1,
        newCount: 1,
      },
    ],
    period: 60,
    host: process.env.GARAGE_URL,
    hostOfStatic: process.env.API_STATIC_URL,
    project: {
      _id: new ObjectId('5d206f7f9aaf7c0071d64596'),
      token: 'project-token',
      name: 'Project',
      workspaceId: new ObjectId('5d206f7f9aaf7c0071d64596'),
      uidAdded: new ObjectId('5d206f7f9aaf7c0071d64596'),
      notifications: [],
    },
  },
} as EventNotification;
