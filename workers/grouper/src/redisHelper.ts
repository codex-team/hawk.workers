import HawkCatcher from '@hawk.so/nodejs';
import redis from 'redis';
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
  private readonly redisClient = redis.createClient({ url: process.env.REDIS_URL });

  /**
   * Logger instance
   * (default level='info')
   */
  private logger = createLogger();

  /**
   * Checks if a lock exists on the given group hash and identifier pair. If it does not exist, creates a lock.
   * Returns true if lock exists
   *
   * @param groupHash - event group hash
   * @param userId - event user id
   */
  public checkOrSetEventLock(groupHash: string, userId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const callback = this.createCallback(resolve, reject);


      this.redisClient.set(`${groupHash}:${userId}`, '1', 'EX', RedisHelper.LOCK_TTL, 'NX', callback);
    });
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
      this.logger.info('Successfully saved to Redis');
      resolve(resp !== 'OK');
    };
  }
}
