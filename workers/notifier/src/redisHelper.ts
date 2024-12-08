import { createClient } from 'redis';
import createLogger from '../../../lib/logger';

/**
 * Class with helper functions for working with Redis
 */
export default class RedisHelper {
  /**
   * Redis client for making queries
   */
  private readonly redisClient = createClient({ url: process.env.REDIS_URL });

  /**
   * Logger instance
   * (default level='info')
   */
  private logger = createLogger();

  /**
   * @param projectId - id of the project to add the event to digest
   * @param groupHash - hash of the event group
   */
  public async addEventToDigest(projectId: string, groupHash: string): Promise<void> {
    this.logger.debug('Stored in Redis digest');

    const script = `
    local structure_key = KEYS[1]
    local group_hash = ARGV[1]
    
    -- Check if current project has a digest
    if redis.call("EXISTS", structure_key) == 0 then
        -- If there is no digest for current project, create it
        redis.call("ZADD", structure_key, 1, group_hash)
        return 1
    else
        -- If there is a digest for current project, increment the score
        local current_score = redis.call("ZSCORE", structure_key, group_hash)
        if current_score then
            redis.call("ZINCRBY", structure_key, 1, group_hash)
            return current_score + 1
        else
            redis.call("ZADD", structure_key, 1, group_hash)
            return 1
        end
    end
    `;

    const digestKey = `digest:${projectId}`;

    await this.redisClient.eval(script, {
      keys: [ digestKey ],
      arguments: [ groupHash ],
    });
  }

  /**
   * Method that get repetitions event repetitions count from todays digest of the project
   *
   * @param projectId - id of the project to get the repetitions count from
   * @param groupHash - hash of the event group
   * @returns {number | null} event repetitions count from the digest
   */
  public async getEventRepetitionsFromDigest(projectId: string, groupHash: string): Promise<number | null> {
    const digestRepetitionCount = await this.redisClient.get(`digest:${projectId}:${groupHash}`);

    return (digestRepetitionCount !== null) ? parseInt(digestRepetitionCount) : null;
  }

  /**
   * Method that sets the event threshold in redis storage
   *
   * @param projectId - id of the project to set the threshold for
   * @param threshold - threshold value to set
   */
  public setProjectNotificationTreshold(projectId: string, threshold: number): void {
    this.redisClient.set(`threshold:${projectId}`, threshold.toString());
  }

  /**
   * Method that gets the event threshold from redis storage
   *
   * @param projectId - id of the project to get the threshold from
   * @returns {number | null} threshold value for the project, or null if it is not stored in redis
   */
  public async getProjectNotificationThreshold(projectId: string): Promise<number | null> {
    const threshold = await this.redisClient.get(`threshold:${projectId}`);

    return (threshold !== null) ? parseInt(threshold) : null;
  }
}
