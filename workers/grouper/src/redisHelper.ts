import HawkCatcher from '@hawk.so/nodejs';
import type { RedisClientType } from 'redis';
import { createClient } from 'redis';
import createLogger from '../../../lib/logger';
import { MS_IN_SEC } from '../../../lib/utils/consts';

/**
 * Class with helper functions for working with Redis
 */
export default class RedisHelper {
  /**
   * How long lock-records will live in Redis (in secs)
   */
  private static readonly LOCK_TTL = 10;

  /**
   * Redis client for making queries
   */
  private readonly redisClient: RedisClientType;

  /**
   * Logger instance
   * (default level='info')
   */
  private logger = createLogger();

  /**
   * Constructor of the Redis helper class
   * Initializes the Redis client and sets up error handling
   */
  constructor() {
    try {
      this.redisClient = createClient({ url: process.env.REDIS_URL });
      this.redisClient.on('error', (error) => {
        console.log('redis error', error);

        if (error) {
          this.logger.error('Redis error: ', error);
          HawkCatcher.send(error);
        }
      });
    } catch (error) {
      console.error('Error creating redis client', error);
    }
  }

  /**
   * Connect to redis client
   */
  public async initialize(): Promise<void> {
    try {
      await this.redisClient.connect();
    } catch (error) {
      console.error('Error connecting to redis', error);
    }
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
   * Checks if a lock exists on the given group hash and identifier pair. If it does not exist, creates a lock.
   * Returns true if lock exists
   *
   * @param groupHash - event group hash
   * @param userId - event user id
   */
  public async checkOrSetlockEventForAffectedUsersIncrement(groupHash: string, userId: string): Promise<boolean> {
    const result = await this.redisClient.set(
      `${groupHash}:${userId}`,
      '1',
      {
        EX: RedisHelper.LOCK_TTL,
        NX: true,
      } as const
    );

    /**
     * Result would be null if lock already exists, false otherwise
     */
    return result === null;
  }

  /**
   * Checks if a lock exists on the given group hash, identifier and timestamp. If it does not exist, creates a lock.
   * Returns true if lock exists
   *
   * @param groupHash - event group hash
   * @param userId - event user id
   * @param timestamp - event timestamp for daily events
   */
  public async checkOrSetlockDailyEventForAffectedUsersIncrement(groupHash: string, userId: string, timestamp: number): Promise<boolean> {
    const result = await this.redisClient.set(
      `${groupHash}:${userId}:${timestamp}`,
      '1',
      {
        EX: RedisHelper.LOCK_TTL,
        NX: true,
      } as const
    );

    /**
     * Result would be null if lock already exists, false otherwise
     */
    return result === null;
  }

  /**
   * Increments redis counter used for rate limiting
   *
   * @param projectId - id of the project which event belongs to
   * @param eventsPeriod - rate limit period configured for the project
   */
  public async incrementRateLimitCounterForCurrentEvent(projectId: string, eventsPeriod: number, limit: number): Promise<void> {
    const script = `
    local key = KEYS[1]
    local field = ARGV[1]
    local now = tonumber(ARGV[2])
    local period = tonumber(ARGV[3])
    local limit = tonumber(ARGV[4])

    local current = redis.call('HGET', key, field)

    -- If no record yet, start a new window with count = 1
    if not current then
        redis.call('HSET', key, field, now .. ':1')
        return
    end

    local timestamp, count = string.match(current, '(%d+):(%d+)')
    timestamp = tonumber(timestamp)
    count = tonumber(count)

    -- Check if we're in a new time window
    if now - timestamp >= period then
        redis.call('HSET', key, field, now .. ':1')
        return
    end

    -- Check if incrementing would exceed limit
    if count + 1 > limit then
        return
    end

    -- Increment counter
    redis.call('HSET', key, field, timestamp .. ':' .. (count + 1))
    `

    const key = 'rate_limits';
    const now = Math.floor(Date.now() / MS_IN_SEC);

    await this.redisClient.eval(script, {
      keys: [key],
      arguments: [projectId, now.toString(), eventsPeriod.toString(), limit.toString()],
    });
  }

  /**
   * Creates a RedisTimeSeries key if it doesn't exist.
   *
   * @param key - time series key
   * @param labels - labels to attach to the time series
   * @param retentionMs - optional retention in milliseconds
   */
  public async tsCreateIfNotExists(
    key: string,
    labels: Record<string, string>,
    retentionMs = 0
  ): Promise<void> {
    const exists = await this.redisClient.exists(key);

    if (exists > 0) {
      return;
    }

    const args: string[] = ['TS.CREATE', key];

    if (retentionMs > 0) {
      args.push('RETENTION', Math.floor(retentionMs).toString());
    }

    args.push(...this.buildLabelArguments(labels));

    await this.redisClient.sendCommand(args);
  }

  /**
   * Increments a RedisTimeSeries key with labels and timestamp.
   *
   * @param key - time series key
   * @param value - value to increment by
   * @param timestampMs - timestamp in milliseconds, defaults to current time
   * @param labels - labels to attach to the sample
   */
  public async tsIncrBy(
    key: string,
    value: number,
    timestampMs = 0,
    labels: Record<string, string> = {}
  ): Promise<void> {
    const labelArgs = this.buildLabelArguments(labels);
    const timestamp = timestampMs === 0 ? Date.now() : timestampMs;

    const args: string[] = [
      'TS.INCRBY',
      key,
      value.toString(),
      'TIMESTAMP',
      Math.floor(timestamp).toString(),
      ...labelArgs,
    ];

    await this.redisClient.sendCommand(args);
  }

  /**
   * Ensures that a RedisTimeSeries key exists and increments it safely.
   *
   * @param key - time series key
   * @param value - value to increment by
   * @param labels - labels to attach to the time series
   * @param retentionMs - optional retention in milliseconds
   */
  public async safeTsIncrBy(
    key: string,
    value: number,
    labels: Record<string, string>,
    retentionMs = 0
  ): Promise<void> {
    const timestamp = Date.now();

    try {
      await this.tsIncrBy(key, value, timestamp, labels);
    } catch (error) {
      if (error instanceof Error && error.message.includes('TSDB: key does not exist')) {
        this.logger.warn(`TS key ${key} does not exist, creating it...`);
        await this.tsCreateIfNotExists(key, labels, retentionMs);
        await this.tsIncrBy(key, value, timestamp, labels);
      } else {
        throw error;
      }
    }
  }

  /**
   * Adds a sample to a RedisTimeSeries key.
   *
   * @param key - time series key
   * @param value - value to add
   * @param timestampMs - timestamp in milliseconds, defaults to current time
   * @param labels - labels to attach to the sample
   */
  public async tsAdd(
    key: string,
    value: number,
    timestampMs = 0,
    labels: Record<string, string> = {}
  ): Promise<void> {
    const labelArgs = this.buildLabelArguments(labels);
    const timestamp = timestampMs === 0 ? Date.now() : timestampMs;

    const args: string[] = [
      'TS.ADD',
      key,
      Math.floor(timestamp).toString(),
      value.toString(),
      'ON_DUPLICATE',
      'SUM',
      ...labelArgs,
    ];

    await this.redisClient.sendCommand(args);
  }

  /**
   * Ensures that a RedisTimeSeries key exists and adds a sample safely.
   *
   * @param key - time series key
   * @param value - value to add
   * @param labels - labels to attach to the time series
   * @param retentionMs - optional retention in milliseconds
   */
  public async safeTsAdd(
    key: string,
    value: number,
    labels: Record<string, string>,
    retentionMs = 0
  ): Promise<void> {
    const timestamp = Date.now();

    try {
      await this.tsAdd(key, value, timestamp, labels);
    } catch (error) {
      if (error instanceof Error && error.message.includes('TSDB: key does not exist')) {
        this.logger.warn(`TS key ${key} does not exist, creating it...`);
        await this.tsCreateIfNotExists(key, labels, retentionMs);
        await this.tsAdd(key, value, timestamp, labels);
      } else {
        throw error;
      }
    }
  }

  /**
   * Build label arguments for RedisTimeSeries commands
   *
   * @param labels - labels to attach to the time series
   */
  private buildLabelArguments(labels: Record<string, string>): string[] {
    const labelArgs: string[] = ['LABELS'];

    for (const [labelKey, labelValue] of Object.entries(labels)) {
      labelArgs.push(labelKey, labelValue);
    }

    return labelArgs;
  }

  /**
   * Creates callback function for Redis operations
   *
   * @param resolve - callback that will be called if no errors occurred
   * @param reject - callback that will be called any error occurred
   */
  private createCallback(resolve: (result: boolean) => void, reject: (reason?: unknown) => void) {
    return (execError: Error | null, resp: string): void => {
      if (execError) {
        this.logger.error(execError);
        HawkCatcher.send(execError);

        reject(execError);

        return;
      }
      this.logger.debug('Successfully saved to Redis');
      resolve(resp !== 'OK');
    };
  }
}