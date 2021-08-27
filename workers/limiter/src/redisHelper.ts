import HawkCatcher from '@hawk.so/nodejs';
import redis from 'redis';
import createLogger from '../../../lib/logger';

/**
 * Class with helper functions for working with Redis
 */
export default class RedisHelper {
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
   * Redis key for storing banned projects
   */
  private readonly redisDisabledProjectsKey = 'DisabledProjectsSet';

  /**
   * Saves banned project ids to redis
   * If there is no projects, then previous data in Redis will be erased
   *
   * @param projectIdsToBan - ids to ban
   */
  public saveBannedProjectsSet(projectIdsToBan: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const callback = this.createCallback(resolve, reject);

      if (projectIdsToBan.length) {
        this.redisClient.multi()
          .del(this.redisDisabledProjectsKey)
          .sadd(this.redisDisabledProjectsKey, projectIdsToBan)
          .exec(callback);
      } else {
        this.redisClient.del(this.redisDisabledProjectsKey, callback);
      }
    });
  }

  /**
   * Add new banned projects to the set
   *
   * @param projectIds - project ids to append
   */
  public appendBannedProjects(projectIds: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const callback = this.createCallback(resolve, reject);

      if (projectIds.length) {
        this.redisClient.sadd(this.redisDisabledProjectsKey, projectIds, callback);
      } else {
        resolve();
      }
    });
  }

  /**
   * Removes projects ids from set
   *
   * @param projectIds - project ids to remove
   */
  public removeBannedProjects(projectIds: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const callback = this.createCallback(resolve, reject);

      if (projectIds.length) {
        this.redisClient.srem(this.redisDisabledProjectsKey, projectIds, callback);
      } else {
        resolve();
      }
    });
  }

  /**
   * Creates callback function for Redis operations
   *
   * @param resolve - callback that will be called if no errors occurred
   * @param reject - callback that will be called any error occurred
   */
  private createCallback(resolve: () => void, reject: (reason?: unknown) => void) {
    return (execError: Error | null): void => {
      console.log('callback');
      if (execError) {
        this.logger.error(execError);
        HawkCatcher.send(execError);

        reject(execError);

        return;
      }
      this.logger.info('Successfully saved to Redis');
      resolve();
    };
  }
}
