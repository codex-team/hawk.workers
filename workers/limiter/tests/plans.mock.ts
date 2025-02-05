import { PlanDBScheme } from '@hawk.so/types';
import { ObjectId } from 'mongodb';

/**
 * Mocked plans with different events limits
 */
export const mockedPlans: { [key: string]: PlanDBScheme } = {
  /**
   * Plan #1 with small limit
   */
  eventsLimit10: {
    _id: new ObjectId('5e4ff528628a6c714515f4dc'),
    name: 'Test plan #1',
    monthlyCharge: 10,
    monthlyChargeCurrency: 'RUB',
    eventsLimit: 10,
    isDefault: true,
  },

  /**
   * Plan #2 with big limit
   */
  eventsLimit10000: {
    _id: new ObjectId('5e4ff528738a6c714515f4dc'),
    name: 'Test plan #2',
    monthlyCharge: 10,
    monthlyChargeCurrency: 'RUB',
    eventsLimit: 10000,
    isDefault: false,
  },
};
