import '../../../env-test';
import RedisHelper from '../src/redisHelper';
import type { RedisClientType } from 'redis';
import { createClient } from 'redis';
import { MS_IN_SEC } from '../../../lib/utils/consts';

function parseRateLimitValue(value: string): { timestamp: number; count: number } | null {
  const match = /^(\d+):(\d+)$/.exec(value);

  if (!match) {
    return null;
  }

  return {
    timestamp: Number(match[1]),
    count: Number(match[2]),
  };
}

describe('RedisHelper.updateRateLimit', () => {
  let redisClient: RedisClientType;
  let redisHelper: RedisHelper;

  beforeAll(async () => {
    redisClient = createClient({ url: process.env.REDIS_URL });
    await redisClient.connect();
    redisHelper = new RedisHelper();
    await redisHelper.initialize();
  });

  beforeEach(async () => {
    await redisClient.del('rate_limits');
  });

  afterAll(async () => {
    await redisHelper.close();
    await redisClient.quit();
  });

  test('allows events when limit is zero', async () => {
    expect(await redisHelper.updateRateLimit('project-zero', 0, 60)).toBe(true);
    expect(await redisHelper.updateRateLimit('project-zero', 0, 60)).toBe(true);
  });

  test('allows events until the limit is reached', async () => {
    const projectId = 'project-limit';

    expect(await redisHelper.updateRateLimit(projectId, 2, 3600)).toBe(true);
    expect(await redisHelper.updateRateLimit(projectId, 2, 3600)).toBe(true);
    expect(await redisHelper.updateRateLimit(projectId, 2, 3600)).toBe(false);
  });

  test('resets the counter after the period expires', async () => {
    const projectId = 'project-reset';
    const now = Math.floor(Date.now() / MS_IN_SEC);
    const prevTimestamp = now - 3601;

    await redisClient.hSet('rate_limits', projectId, `${prevTimestamp}:5`);

    expect(await redisHelper.updateRateLimit(projectId, 5, 3600)).toBe(true);

    const stored = await redisClient.hGet('rate_limits', projectId);
    const counter = parseRateLimitValue(stored!);

    expect(counter).toEqual({
      timestamp: expect.any(Number),
      count: 1,
    });
    expect(counter!.timestamp).toBeGreaterThan(prevTimestamp);
    expect(counter!.timestamp).toBeGreaterThanOrEqual(now);
  });

  test('keeps the same timestamp when the window is active and limit is reached', async () => {
    const projectId = 'project-deny';
    const now = Math.floor(Date.now() / MS_IN_SEC);
    const prevTimestamp = now - 30;

    await redisClient.hSet('rate_limits', projectId, `${prevTimestamp}:2`);

    expect(await redisHelper.updateRateLimit(projectId, 2, 3600)).toBe(false);

    const stored = await redisClient.hGet('rate_limits', projectId);

    expect(stored).toBe(`${prevTimestamp}:2`);
  });

  test('resets malformed counter values', async () => {
    const projectId = 'project-malformed';

    await redisClient.hSet('rate_limits', projectId, 'invalid');

    expect(await redisHelper.updateRateLimit(projectId, 1, 3600)).toBe(true);
  });
});
