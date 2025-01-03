import { createClient, RedisClientType } from 'redis';
import { Rule } from '../types/rule';
import { NotifierEvent } from '../types/notifier-task';

/**
 * Class with helper functions for working with Redis
 */
export default class RedisHelper {
  /**
   * Redis client for making queries
   */
  private readonly redisClient: RedisClientType;

  /**
   * Create redis client and add error handler to it
   */
  constructor() {
    this.redisClient = createClient({ url: process.env.REDIS_URL });

    this.redisClient.on('error', (error) => {
      console.error(error);
    });
  }

  /**
   * Connect to redis client
   */
  public async initialize(): Promise<void> {
    await this.redisClient.connect();
  }

  /**
   * Close redis client
   */
  public async close(): Promise<void> {
    if (this.redisClient.isOpen) {
      await this.redisClient.quit();
    }
  }

  /**
   * Method that updates the event count respectfully to the threshold reset period
   *
   * @param ruleId - id of the rule used as a part of structure key
   * @param groupHash - event group hash used as a part of structure key
   * @param thresholdPeriod - period of time used to reset the event count
   * @returns {number} current event count
   */
  public async computeEventCountForPeriod(ruleId: string, groupHash: NotifierEvent['groupHash'], thresholdPeriod: Rule['thresholdPeriod']): Promise<number> {
    const script = `
    local key = KEYS[1]
    local currentTimestamp = tonumber(ARGV[1])
    local thresholdPeriod = tonumber(ARGV[2])

    local startPeriodTimestamp = tonumber(redis.call("HGET", key, "timestamp"))

    if ((startPeriodTimestamp == nil) or (currentTimestamp >= startPeriodTimestamp + thresholdPeriod)) then
        redis.call("HSET", key, "timestamp", currentTimestamp)
        redis.call("HSET", key, "eventsCount", 0)
    end
    
    local newCounter = redis.call("HINCRBY", key, "eventsCount", 1)
    return newCounter
    `;

    const key = `${ruleId}:${groupHash}:${thresholdPeriod}`;

    const currentTimestamp = Date.now();

    const currentEventCount = await this.redisClient.eval(script, {
      keys: [ key ],
      arguments: [currentTimestamp.toString(), thresholdPeriod.toString()],
    }) as number;

    return (currentEventCount !== null) ? currentEventCount : 0;
  }
}
