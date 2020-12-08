import { ObjectId } from 'mongodb';

/**
 * Constant of last charge date in all workspaces for tests
 */
const LAST_CHARGE_DATE = new Date(1585742400 * 1000);

/**
 * Mocked workspaces for tests
 */
export const mockedWorkspaces = [
  {
    _id: new ObjectId('5e4ff518628a6c714615f4de'),
    accountId: '',
    balance: 0,
    lastChargeDate: LAST_CHARGE_DATE,
    name: 'Test workspace #1',
    tariffPlanId: new ObjectId('5e4ff528628a6c714515f4dc'),
    billingPeriodEventsCount: 0,
  },
  {
    _id: new ObjectId('5e4ff518628a6b714615f4de'),
    accountId: '',
    balance: 0,
    lastChargeDate: LAST_CHARGE_DATE,
    name: 'Test workspace #2',
    tariffPlanId: new ObjectId('5e4ff528738a6c714515f4dc'),
    billingPeriodEventsCount: 0,
  },
  {
    _id: new ObjectId('5e4ff518639a6b714615f4de'),
    accountId: '',
    balance: 0,
    lastChargeDate: LAST_CHARGE_DATE,
    name: 'Test workspace #3',
    tariffPlanId: new ObjectId('5e4ff528628a6c714515f4dc'),
    billingPeriodEventsCount: 0,
  },
];
