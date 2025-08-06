import { SeveralEventsNotification } from 'hawk-worker-sender/types/template-variables';
import { GroupedEventDBScheme } from '@hawk.so/types';
import { ObjectId } from 'mongodb';

/**
 * Example of several-events notify template variables
 */
export default {
  type: 'several-events',
  payload: {
    events: [
      {
        event: {
          totalCount: 10,
          timestamp: Date.now(),
          payload: {
            title: 'New event',
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
      {
        event: {
          totalCount: 5,
          payload: {
            title: 'New event 2',
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
        daysRepeated: 100,
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
} as SeveralEventsNotification;
