import HawkCatcher from '@hawk.so/nodejs';
import { createClient, RedisClientType } from 'redis';
import createLogger from '../../../lib/logger';

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
    this.redisClient = createClient({ url: process.env.REDIS_URL });

    this.redisClient.on('error', (error) => {
      if (error) {
        this.logger.error(error);
        HawkCatcher.send(error);
      }
    });
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
  public async checkOrSetEventLock(groupHash: string, userId: string): Promise<boolean> {
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
   * Unlock event lock
   *
   * @param groupHash - event group hash
   * @param userId - event user id
   */
  public async unlockEvent(groupHash: string, userId: string): Promise<void> {
    await this.redisClient.del(`${groupHash}:${userId}`);
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
