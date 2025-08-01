import HawkCatcher from '@hawk.so/nodejs';
import { createClient, RedisClientType } from 'redis';
import createLogger from '../../../lib/logger';

/**
 * Class with helper functions for working with Redis
 */
export default class RedisHelper {
  /**
   * Redis client for making queries
   */
  // private readonly redisClient = redis.createClient({ url: process.env.REDIS_URL });
  private readonly redisClient: RedisClientType;

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
   * Constructor of the Redis helper class
   * Initializes the Redis client and sets up error handling
   */
  constructor() {
    this.redisClient = createClient({ url: process.env.REDIS_URL });

    this.redisClient.on('error', (error) => {
      this.logger.error(error);
      HawkCatcher.send(error);
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
   * Add new banned projects to the set
   *
   * @param projectIds - project ids to append
   */
  public appendBannedProjects(projectIds: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const callback = this.createCallback(resolve, reject);

      if (projectIds.length) {
        this.redisClient.sAdd(this.redisDisabledProjectsKey, projectIds)
          .then(() => callback(null))
          .catch((err) => callback(err));
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
        this.redisClient.sRem(this.redisDisabledProjectsKey, projectIds)
          .then(() => callback(null))
          .catch((err) => callback(err));
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
