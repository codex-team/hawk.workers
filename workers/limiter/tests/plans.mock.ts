import { ObjectId } from 'mongodb';
import { PlanDBScheme } from 'hawk.types';

/**
 * Mocked plans with different events limits
 */
export const mockedPlans: PlanDBScheme[] = [
  /**
   * Plan #1 with small limit
   */
  {
    _id: new ObjectId('5e4ff528628a6c714515f4dc'),
    name: 'Test plan #1',
    monthlyCharge: 10,
    eventsLimit: 10,
    isDefault: true,
  },

  /**
   * Plan #2 with big limit
   */
  {
    _id: new ObjectId('5e4ff528738a6c714515f4dc'),
    name: 'Test plan #2',
    monthlyCharge: 10,
    eventsLimit: 10000,
    isDefault: false,
  },
];
