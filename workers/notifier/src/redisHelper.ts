import { createClient } from 'redis';
import { Rule } from '../types/rule';
import { NotifierEvent } from '../types/notifier-task';

/**
 * Class with helper functions for working with Redis
 */
export default class RedisHelper {
  /**
   * Redis client for making queries
   */
  private readonly redisClient = createClient({ url: process.env.REDIS_URL });

  /**
   * Method that updates the event count respectfully to the threshold reset period
   * @param ruleId - id of the rule used as a part of structure key
   * @param groupHash - event group hash used as a part of structure key
   * @param thresholdPeriod - period of time used to reset the event count
   * @returns current event count
   */
  public async getCurrentEventCount(ruleId: string, groupHash: NotifierEvent['groupHash'], thresholdPeriod: Rule['eventThresholdPeriod']): Promise<number> {
    const script = `
    local key = KEYS[1]
    local currentTimestamp = tonumber(ARGV[1])
    local expirationPeriod = tonumber(ARGV[2])

    local startPeriodTimestamp = tonumber(redis.call("HGET", key, "timestamp"))

    if (startPeriodTimestamp > expirationPeriod or startPeriodTimestamp == nil) then
        redis.call("HSET", key, "timestamp", currentTimestamp)

        // return 1 if period has been reset
        return 1
    else
        local newCounter = redis.call("HINCRBY", key, "counter", 1)
        return newCounter
    end
    `;

    const key = `${ruleId}:${groupHash}:${thresholdPeriod}:times`;

    const currentEventCount = await this.redisClient.eval(script, {
      keys: [key],
      arguments: [Date.now().toString(), (Date.now() + thresholdPeriod).toString()],
    }) as number;

    return (currentEventCount !== null) ? currentEventCount : 0;
  }
}
