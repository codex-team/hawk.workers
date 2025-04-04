import { createClient, RedisClientType } from 'redis';
import { Rule } from '../types/rule';
import { NotifierEvent } from '../types/notifier-task';
import { MS_IN_SEC } from '../../../lib/utils/consts';

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
   * @param projectId - id of the project used as a part of structure key
   * @param ruleId - id of the rule used as a part of structure key
   * @param groupHash - event group hash used as a part of structure key
   * @param thresholdPeriod - period of time used to reset the event count
   * @returns {number} current event count
   */
  public async computeEventCountForPeriod(
    projectId: string,
    ruleId: string,
    groupHash: NotifierEvent['groupHash'],
    thresholdPeriod: Rule['thresholdPeriod']
  ): Promise<number> {
    const script = `
    local key = KEYS[1]
    local currentTimestamp = tonumber(ARGV[1])
    local thresholdPeriod = tonumber(ARGV[2])
    local ttl = tonumber(ARGV[3])

    local startPeriodTimestamp = tonumber(redis.call("HGET", key, "timestamp"))

    if ((startPeriodTimestamp == nil) or (currentTimestamp >= startPeriodTimestamp + thresholdPeriod)) then
        redis.call("HSET", key, "timestamp", currentTimestamp)
        redis.call("HSET", key, "eventsCount", 0)
        redis.call("EXPIRE", key, ttl)
    end
    
    local newCounter = redis.call("HINCRBY", key, "eventsCount", 1)
    return newCounter
    `;

    const key = `${projectId}:${ruleId}:${groupHash}:${thresholdPeriod}:times`;

    /**
     * Treshold period is in milliseconds, but redis expects ttl in seconds
     */
    const ttl = Math.floor(thresholdPeriod / MS_IN_SEC);

    const currentTimestamp = Date.now();

    const currentEventCount = await this.redisClient.eval(script, {
      keys: [ key ],
      arguments: [currentTimestamp.toString(), thresholdPeriod.toString(), ttl.toString()],
    }) as number;

    return (currentEventCount !== null) ? currentEventCount : 0;
  }
}
