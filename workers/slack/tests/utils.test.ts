import { ObjectId } from 'mongodb';
import { ProjectDBScheme, GroupedEventDBScheme } from '@hawk.so/types';
import { getEventUrl } from '../src/templates/utils';

const project = {
  _id: new ObjectId('5d206f7f9aaf7c0071d64596'),
  token: 'project-token',
  name: 'Project',
  workspaceId: new ObjectId('5d206f7f9aaf7c0071d64596'),
  uidAdded: new ObjectId('5d206f7f9aaf7c0071d64596'),
  notifications: [],
} as ProjectDBScheme;

const event = {
  _id: new ObjectId('5d206f7f9aaf7c0071d64597'),
  payload: { title: 'Error' },
} as unknown as GroupedEventDBScheme;

const host = 'https://garage.hawk.so';

describe('getEventUrl', () => {
  it('should return base URL with trailing slash when no repetitionId', () => {
    const url = getEventUrl(host, project, event);

    expect(url).toBe(`${host}/project/${project._id}/event/${event._id}/`);
  });

  it('should return base URL with trailing slash when repetitionId is null', () => {
    const url = getEventUrl(host, project, event, null);

    expect(url).toBe(`${host}/project/${project._id}/event/${event._id}/`);
  });

  it('should append repetitionId and /overview when repetitionId is provided', () => {
    const repetitionId = '5d206f7f9aaf7c0071d64599';
    const url = getEventUrl(host, project, event, repetitionId);

    expect(url).toBe(`${host}/project/${project._id}/event/${event._id}/${repetitionId}/overview`);
  });
});
