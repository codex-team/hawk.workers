import { ObjectId } from 'mongodb';
import { mockedPlans } from './plans.mock';

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
    tariffPlanId: mockedPlans.find(plan => plan.eventsLimit === 10)._id,
    billingPeriodEventsCount: 0,
  },
  {
    _id: new ObjectId('5e4ff518628a6b714615f4de'),
    accountId: '',
    balance: 0,
    lastChargeDate: LAST_CHARGE_DATE,
    name: 'Test workspace #2',
    tariffPlanId: mockedPlans.find(plan => plan.eventsLimit === 10000)._id,
    billingPeriodEventsCount: 0,
  },
  {
    _id: new ObjectId('5e4ff518639a6b714615f4de'),
    accountId: '',
    balance: 0,
    lastChargeDate: LAST_CHARGE_DATE,
    name: 'Test workspace #3',
    tariffPlanId: mockedPlans.find(plan => plan.eventsLimit === 10)._id,
    billingPeriodEventsCount: 0,
  },
  {
    _id: new ObjectId('5e4ff529639a6b714615f4de'),
    accountId: '',
    balance: 0,
    lastChargeDate: LAST_CHARGE_DATE,
    name: 'Test workspace #4',
    tariffPlanId: mockedPlans.find(plan => plan.eventsLimit === 10)._id,
    billingPeriodEventsCount: 0,
  },
];
