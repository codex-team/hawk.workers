import { ObjectId } from 'mongodb';
import { mockedPlans } from './plans.mock';

/**
 * Constant of last charge date in all workspaces for tests
 */
const LAST_CHARGE_DATE = new Date(1585742400 * 1000);

/**
 * Contains workspaces and projects for tests
 */
export const mockedData = {
  forCountingEvents: {
    workspace: {
      _id: new ObjectId('5e4ff518628a6c714615f4de'),
      name: 'Test workspace #1',
      tariffPlanId: mockedPlans.withSmallLimit._id,
      lastChargeDate: LAST_CHARGE_DATE,
      billingPeriodEventsCount: 0,
      accountId: '',
      balance: 0,
    },
    project: {
      _id: new ObjectId('5e4ff518618a6c714515f4da'),
      name: 'Test project #1',
      workspaceId: new ObjectId('5e4ff518628a6c714615f4de'),
      notifications: [],
      token: '5342',
      uidAdded: new ObjectId('5e4ff518628a6c714515f4db'),
    },
  },
  forBanAndAddingToRedis: {
    workspace: {
      _id: new ObjectId('5e4ff529639a6b714615f4de'),
      name: 'Test workspace #2',
      tariffPlanId: mockedPlans.withSmallLimit._id,
      lastChargeDate: LAST_CHARGE_DATE,
      billingPeriodEventsCount: 0,
      accountId: '',
      balance: 0,
    },
    project: {
      _id: new ObjectId('5e4ff438618a6c736515f4da'),
      name: 'Test project #2',
      workspaceId: new ObjectId('5e4ff529639a6b714615f4de'),
      notifications: [],
      token: '5342',
      uidAdded: new ObjectId('5e4ff518628a6c725515f4db'),
    },
  },
  forUnbanPreviouslyBanned: {
    workspace: {
      _id: new ObjectId('5e4ff518639a6b714615f4de'),
      name: 'Test workspace #3',
      tariffPlanId: mockedPlans.withSmallLimit._id,
      lastChargeDate: LAST_CHARGE_DATE,
      billingPeriodEventsCount: 0,
      accountId: '',
      balance: 0,
    },
    project: {
      _id: new ObjectId('5e4ff518618a6c736515f4da'),
      name: 'Test project #3',
      workspaceId: new ObjectId('5e4ff518639a6b714615f4de'),
      notifications: [],
      token: '5342',
      uidAdded: new ObjectId('5e4ff518628a6c725515f4db'),
    },
  },
  forNotBanned: {
    workspace: {
      _id: new ObjectId('5e4ff518628a6b714615f4de'),
      name: 'Test workspace #4',
      tariffPlanId: mockedPlans.withBigLimit._id,
      lastChargeDate: LAST_CHARGE_DATE,
      accountId: '',
      balance: 0,
      billingPeriodEventsCount: 0,
    },
    project: {
      _id: new ObjectId('5e4ff518618a6c725515f4da'),
      name: 'Test project #4',
      workspaceId: new ObjectId('5e4ff518628a6b714615f4de'),
      notifications: [],
      token: '5342',
      uidAdded: new ObjectId('5e4ff518628a6c725515f4db'),
    },
  },
};
