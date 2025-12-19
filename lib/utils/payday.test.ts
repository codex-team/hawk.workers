import { getPayday, countDaysBeforePayday, countDaysAfterPayday, countDaysAfterBlock } from './payday';
import { WorkspaceDBScheme } from '@hawk.so/types';
import { ObjectId } from 'mongodb';

/**
 * Mock the Date constructor to allow controlling "now"
 */
let mockedNow: number | null = null;

const setMockedNow = (date: Date) => {
  mockedNow = date.getTime();
};

const resetMockedNow = () => {
  mockedNow = null;
};

// Override Date constructor
const RealDate = Date;
global.Date = class extends RealDate {
  constructor(...args: any[]) {
    if (args.length === 0 && mockedNow !== null) {
      super(mockedNow);
    } else {
      super(...(args as []));
    }
  }

  static now() {
    return mockedNow !== null ? mockedNow : RealDate.now();
  }
} as DateConstructor;

describe('Payday utility functions', () => {
  afterEach(() => {
    resetMockedNow();
  });

  describe('getPayday', () => {
    it('should return paidUntil date when provided', () => {
      const lastChargeDate = new Date('2025-11-01');
      const paidUntil = new Date('2025-12-15');

      const result = getPayday(lastChargeDate, paidUntil);

      expect(result).toEqual(paidUntil);
    });

    it('should calculate payday as one month after lastChargeDate when paidUntil is not provided', () => {
      const lastChargeDate = new Date('2025-11-01');

      const result = getPayday(lastChargeDate);

      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(11); // December (0-indexed)
      expect(result.getDate()).toBe(1);
    });

    it('should handle year transition correctly', () => {
      const lastChargeDate = new Date('2025-12-15');

      const result = getPayday(lastChargeDate);

      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(0); // January (0-indexed)
      expect(result.getDate()).toBe(15);
    });

    it('should add one day when isDebug is true', () => {
      const lastChargeDate = new Date('2025-12-01');

      const result = getPayday(lastChargeDate, null, true);

      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(11); // December (0-indexed)
      expect(result.getDate()).toBe(2);
    });

    it('should prioritize paidUntil over debug mode', () => {
      const lastChargeDate = new Date('2025-11-01');
      const paidUntil = new Date('2025-12-15');

      const result = getPayday(lastChargeDate, paidUntil, true);

      expect(result).toEqual(paidUntil);
    });

    it('should handle end of month dates correctly', () => {
      const lastChargeDate = new Date('2025-01-31');

      const result = getPayday(lastChargeDate);

      // JavaScript will adjust to the last day of February
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(2); // March (0-indexed)
      expect(result.getDate()).toBe(3); // Adjusted from Feb 31 to Mar 3
    });
  });

  describe('countDaysBeforePayday', () => {
    it('should return positive days when payday is in the future', () => {
      const now = new Date('2025-12-01');
      const lastChargeDate = new Date('2025-11-20');

      setMockedNow(now);

      const result = countDaysBeforePayday(lastChargeDate);

      expect(result).toBe(19); // Dec 20 - Dec 1 = 19 days
    });

    it('should return 0 when payday is today', () => {
      // Payday is calculated as one month after lastChargeDate, so Dec 20 12pm
      const now = new Date('2025-12-20T12:00:00.000Z');
      const lastChargeDate = new Date('2025-11-20T12:00:00.000Z');

      setMockedNow(now);

      const result = countDaysBeforePayday(lastChargeDate);

      expect(result).toBe(0);
    });

    it('should return negative days when payday has passed', () => {
      const now = new Date('2025-12-25');
      const lastChargeDate = new Date('2025-11-20');

      setMockedNow(now);

      const result = countDaysBeforePayday(lastChargeDate);

      expect(result).toBe(-5); // Dec 20 - Dec 25 = -5 days
    });

    it('should use paidUntil when provided', () => {
      const now = new Date('2025-12-01');
      const lastChargeDate = new Date('2025-10-01');
      const paidUntil = new Date('2025-12-15');

      setMockedNow(now);

      const result = countDaysBeforePayday(lastChargeDate, paidUntil);

      expect(result).toBe(14); // Dec 15 - Dec 1 = 14 days
    });

    it('should work correctly in debug mode', () => {
      const now = new Date('2025-12-01T00:00:00Z');
      const lastChargeDate = new Date('2025-11-30T00:00:00Z');

      setMockedNow(now);

      const result = countDaysBeforePayday(lastChargeDate, null, true);

      expect(result).toBe(0); // Next day is Dec 1, same as now
    });

    it('should handle cross-year payday correctly', () => {
      const now = new Date('2025-12-20');
      const lastChargeDate = new Date('2025-12-15');

      setMockedNow(now);

      const result = countDaysBeforePayday(lastChargeDate);

      expect(result).toBe(26); // Jan 15, 2026 - Dec 20, 2025 = 26 days
    });
  });

  describe('countDaysAfterPayday', () => {
    it('should return 0 when payday is today', () => {
      const now = new Date('2025-12-20T12:00:00Z');
      const lastChargeDate = new Date('2025-11-20T00:00:00Z');

      setMockedNow(now);

      const result = countDaysAfterPayday(lastChargeDate);

      expect(result).toBe(0);
    });

    it('should return positive days when payday has passed', () => {
      const now = new Date('2025-12-25');
      const lastChargeDate = new Date('2025-11-20');

      setMockedNow(now);

      const result = countDaysAfterPayday(lastChargeDate);

      expect(result).toBe(5); // Dec 25 - Dec 20 = 5 days
    });

    it('should return negative days when payday is in the future', () => {
      const now = new Date('2025-12-01');
      const lastChargeDate = new Date('2025-11-20');

      setMockedNow(now);

      const result = countDaysAfterPayday(lastChargeDate);

      expect(result).toBe(-19); // Dec 1 - Dec 20 = -19 days
    });

    it('should use paidUntil when provided', () => {
      const now = new Date('2025-12-20');
      const lastChargeDate = new Date('2025-10-01');
      const paidUntil = new Date('2025-12-15');

      setMockedNow(now);

      const result = countDaysAfterPayday(lastChargeDate, paidUntil);

      expect(result).toBe(5); // Dec 20 - Dec 15 = 5 days
    });

    it('should work correctly in debug mode', () => {
      const now = new Date('2025-12-03T00:00:00Z');
      const lastChargeDate = new Date('2025-12-01T00:00:00Z');

      setMockedNow(now);

      const result = countDaysAfterPayday(lastChargeDate, null, true);

      expect(result).toBe(1); // Dec 3 - Dec 2 = 1 day
    });

    it('should be the inverse of countDaysBeforePayday', () => {
      const now = new Date('2025-12-15');
      const lastChargeDate = new Date('2025-11-20');

      setMockedNow(now);

      const daysBefore = countDaysBeforePayday(lastChargeDate);
      const daysAfter = countDaysAfterPayday(lastChargeDate);

      expect(daysBefore).toBe(-daysAfter);
    });
  });

  describe('countDaysAfterBlock', () => {
    it('should return undefined when blockedDate is not set', () => {
      const workspace: WorkspaceDBScheme = {
        _id: new ObjectId(),
        name: 'Test Workspace',
        inviteHash: 'test-hash',
        tariffPlanId: new ObjectId(),
        billingPeriodEventsCount: 0,
        lastChargeDate: new Date(),
        accountId: 'test-account',
        balance: 0,
        blockedDate: null,
      };

      const result = countDaysAfterBlock(workspace);

      expect(result).toBeUndefined();
    });

    it('should return 0 when workspace was blocked today', () => {
      const now = new Date('2025-12-18T12:00:00Z');
      const blockedDate = new Date('2025-12-18T00:00:00Z');

      setMockedNow(now);

      const workspace: WorkspaceDBScheme = {
        _id: new ObjectId(),
        name: 'Test Workspace',
        inviteHash: 'test-hash',
        tariffPlanId: new ObjectId(),
        billingPeriodEventsCount: 0,
        lastChargeDate: new Date(),
        accountId: 'test-account',
        balance: 0,
        blockedDate,
      };

      const result = countDaysAfterBlock(workspace);

      expect(result).toBe(0);
    });

    it('should return correct number of days after block', () => {
      const now = new Date('2025-12-18');
      const blockedDate = new Date('2025-12-10');

      setMockedNow(now);

      const workspace: WorkspaceDBScheme = {
        _id: new ObjectId(),
        name: 'Test Workspace',
        inviteHash: 'test-hash',
        tariffPlanId: new ObjectId(),
        billingPeriodEventsCount: 0,
        lastChargeDate: new Date(),
        accountId: 'test-account',
        balance: 0,
        blockedDate,
      };

      const result = countDaysAfterBlock(workspace);

      expect(result).toBe(8); // Dec 18 - Dec 10 = 8 days
    });

    it('should handle cross-month blocks correctly', () => {
      const now = new Date('2025-12-05');
      const blockedDate = new Date('2025-11-28');

      setMockedNow(now);

      const workspace: WorkspaceDBScheme = {
        _id: new ObjectId(),
        name: 'Test Workspace',
        inviteHash: 'test-hash',
        tariffPlanId: new ObjectId(),
        billingPeriodEventsCount: 0,
        lastChargeDate: new Date(),
        accountId: 'test-account',
        balance: 0,
        blockedDate,
      };

      const result = countDaysAfterBlock(workspace);

      expect(result).toBe(7); // Dec 5 - Nov 28 = 7 days
    });

    it('should handle cross-year blocks correctly', () => {
      const now = new Date('2026-01-05');
      const blockedDate = new Date('2025-12-28');

      setMockedNow(now);

      const workspace: WorkspaceDBScheme = {
        _id: new ObjectId(),
        name: 'Test Workspace',
        inviteHash: 'test-hash',
        tariffPlanId: new ObjectId(),
        billingPeriodEventsCount: 0,
        lastChargeDate: new Date(),
        accountId: 'test-account',
        balance: 0,
        blockedDate,
      };

      const result = countDaysAfterBlock(workspace);

      expect(result).toBe(8); // Jan 5, 2026 - Dec 28, 2025 = 8 days
    });
  });

  describe('Integration scenarios', () => {
    it('should handle paymaster workflow: 3 days before payday', () => {
      const now = new Date('2025-12-17');
      const lastChargeDate = new Date('2025-11-20');

      setMockedNow(now);

      const daysLeft = countDaysBeforePayday(lastChargeDate);

      expect(daysLeft).toBe(3);
    });

    it('should handle paymaster workflow: payday passed by 3 days', () => {
      const now = new Date('2025-12-23');
      const lastChargeDate = new Date('2025-11-20');

      setMockedNow(now);

      const daysAfter = countDaysAfterPayday(lastChargeDate);

      expect(daysAfter).toBe(3);
    });

    it('should handle prepaid workspace with paidUntil date', () => {
      const now = new Date('2025-12-10');
      const lastChargeDate = new Date('2025-11-01');
      const paidUntil = new Date('2026-01-15');

      setMockedNow(now);

      const daysLeft = countDaysBeforePayday(lastChargeDate, paidUntil);

      expect(daysLeft).toBe(36); // Jan 15, 2026 - Dec 10, 2025
    });

    it('should handle workspace blocked for multiple days', () => {
      const now = new Date('2025-12-18');
      const blockedDate = new Date('2025-12-10');

      setMockedNow(now);

      const workspace: WorkspaceDBScheme = {
        _id: new ObjectId(),
        name: 'Test Workspace',
        inviteHash: 'test-hash',
        tariffPlanId: new ObjectId(),
        billingPeriodEventsCount: 0,
        lastChargeDate: new Date('2025-11-20'),
        accountId: 'test-account',
        balance: 0,
        blockedDate,
        isBlocked: true,
      };

      const daysAfterBlock = countDaysAfterBlock(workspace);
      // Payday was Dec 20, now is Dec 18, so -2 days (payday hasn't arrived yet)
      const daysAfterPayday = countDaysAfterPayday(workspace.lastChargeDate);

      expect(daysAfterBlock).toBe(8);
      expect(daysAfterPayday).toBe(-2); // Payday is in the future
    });
  });
});
