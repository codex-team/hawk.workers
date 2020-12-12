import { ProjectDBScheme } from 'hawk.types';
import { ObjectId } from 'mongodb';

/**
 * Mocked projects for tests
 */
export const mockedProjects: ProjectDBScheme[] = [
  {
    notifications: [],
    token: '5342',
    uidAdded: new ObjectId('5e4ff518628a6c714515f4db'),
    workspaceId: new ObjectId('5e4ff518628a6c714615f4de'),
    _id: new ObjectId('5e4ff518618a6c714515f4da'),
    name: 'Test project #1',
  },
  {
    notifications: [],
    token: '5342',
    uidAdded: new ObjectId('5e4ff518628a6c725515f4db'),
    workspaceId: new ObjectId('5e4ff518628a6b714615f4de'),
    _id: new ObjectId('5e4ff518618a6c725515f4da'),
    name: 'Test project #2',
  },
  {
    notifications: [],
    token: '5342',
    uidAdded: new ObjectId('5e4ff518628a6c725515f4db'),
    workspaceId: new ObjectId('5e4ff518639a6b714615f4de'),
    _id: new ObjectId('5e4ff518618a6c736515f4da'),
    name: 'Test project #3',
  },
  {
    notifications: [],
    token: '5342',
    uidAdded: new ObjectId('5e4ff518628a6c725515f4db'),
    workspaceId: new ObjectId('5e4ff529639a6b714615f4de'),
    _id: new ObjectId('5e4ff438618a6c736515f4da'),
    name: 'Test project #4',
  },
];
