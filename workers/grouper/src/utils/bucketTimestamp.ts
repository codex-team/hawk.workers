import TimeMs from '../../../../lib/utils/time';

/**
 * Returns the current time truncated to the start of the given granularity
 * bucket in milliseconds (UTC). All events within the same bucket share one
 * timestamp so ON_DUPLICATE SUM accumulates them into a single sample.
 *
 * @param granularity - time granularity level
 * @param now - current timestamp in ms, defaults to Date.now()
 */
export function bucketTimestampMs(granularity: 'minutely' | 'hourly' | 'daily', now = Date.now()): number {
  switch (granularity) {
    case 'hourly': return now - (now % TimeMs.HOUR);
    case 'daily': return now - (now % TimeMs.DAY);
    default: return now - (now % TimeMs.MINUTE); // minutely
  }
}
