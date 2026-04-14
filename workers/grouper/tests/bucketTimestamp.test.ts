import '../../../env-test';
import { bucketTimestampMs } from '../src/utils/bucketTimestamp';

describe('bucketTimestampMs', () => {
  /**
   * 2026-04-14T15:37:42.500Z
   * minute start: 2026-04-14T15:37:00.000Z
   * hour start:   2026-04-14T15:00:00.000Z
   * day start:    2026-04-14T00:00:00.000Z
   */
  const now = new Date('2026-04-14T15:37:42.500Z').getTime();

  it('truncates to the start of the current minute', () => {
    const expected = new Date('2026-04-14T15:37:00.000Z').getTime();

    expect(bucketTimestampMs('minutely', now)).toBe(expected);
  });

  it('truncates to the start of the current hour', () => {
    const expected = new Date('2026-04-14T15:00:00.000Z').getTime();

    expect(bucketTimestampMs('hourly', now)).toBe(expected);
  });

  it('truncates to the start of the current day (UTC midnight)', () => {
    const expected = new Date('2026-04-14T00:00:00.000Z').getTime();

    expect(bucketTimestampMs('daily', now)).toBe(expected);
  });

  it('returns the same value for two calls within the same minute', () => {
    const t1 = new Date('2026-04-14T15:37:00.000Z').getTime();
    const t2 = new Date('2026-04-14T15:37:59.999Z').getTime();

    expect(bucketTimestampMs('minutely', t1)).toBe(bucketTimestampMs('minutely', t2));
  });

  it('returns different values for two calls in different minutes', () => {
    const t1 = new Date('2026-04-14T15:37:59.999Z').getTime();
    const t2 = new Date('2026-04-14T15:38:00.000Z').getTime();

    expect(bucketTimestampMs('minutely', t1)).not.toBe(bucketTimestampMs('minutely', t2));
  });

  it('returns the same value for two calls within the same hour', () => {
    const t1 = new Date('2026-04-14T15:00:00.000Z').getTime();
    const t2 = new Date('2026-04-14T15:59:59.999Z').getTime();

    expect(bucketTimestampMs('hourly', t1)).toBe(bucketTimestampMs('hourly', t2));
  });

  it('returns the same value for two calls within the same day', () => {
    const t1 = new Date('2026-04-14T00:00:00.000Z').getTime();
    const t2 = new Date('2026-04-14T23:59:59.999Z').getTime();

    expect(bucketTimestampMs('daily', t1)).toBe(bucketTimestampMs('daily', t2));
  });

  it('returns different values for two calls on different days', () => {
    const t1 = new Date('2026-04-14T23:59:59.999Z').getTime();
    const t2 = new Date('2026-04-15T00:00:00.000Z').getTime();

    expect(bucketTimestampMs('daily', t1)).not.toBe(bucketTimestampMs('daily', t2));
  });
});
