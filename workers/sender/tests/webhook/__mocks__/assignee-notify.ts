import { AssigneeNotification } from 'hawk-worker-sender/types/template-variables';
import { ObjectId } from 'mongodb';

/**
 * Example of assignee notify template variables
 */
export default {
  type: 'assignee',
  payload: {
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
    event: {
      totalCount: 5,
      groupHash: 'abc123',
      payload: {
        title: 'TypeError: Cannot read property',
      },
    },
    whoAssigned: {
      name: 'John Doe',
      email: 'john@example.com',
    },
    assignee: {
      name: 'Jane Smith',
      email: 'jane@example.com',
    },
    daysRepeated: 3,
  },
} as AssigneeNotification;
