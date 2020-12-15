import { ObjectId } from 'mongodb';

/**
 * Mocked plans with different events limits
 */
export const mockedPlans = {
  /**
   * Plan #1 with small limit
   */
  withSmallLimit: {
    _id: new ObjectId('5e4ff528628a6c714515f4dc'),
    name: 'Test plan #1',
    monthlyCharge: 10,
    eventsLimit: 10,
    isDefault: true,
  },

  /**
   * Plan #2 with big limit
   */
  withBigLimit: {
    _id: new ObjectId('5e4ff528738a6c714515f4dc'),
    name: 'Test plan #2',
    monthlyCharge: 10,
    eventsLimit: 10000,
    isDefault: false,
  },
};
