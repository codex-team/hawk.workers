/**
 * Redis connection pool. Used to execute multiple commands at once.
 * Useful with blocking commands like `brpop` not to block entire connection to wait for result.
 */

const genericPool = require('generic-pool');
const Redis = require('ioredis');
const debug = require('debug')('poolRedis');

/**
 * Factory for genericPool.createPool
 */
const factory = {
  create: () => {
    return Promise.resolve(new Redis(process.env.REDIS_URL));
  },
  destroy: client => {
    Promise.resolve(client.quit());
  }
};

/**
 * Creates redis connection pool.
 * @param {number} max Maximum number of connections
 * @returns {genericPool.Pool} Redis pool
 */
const createRedisPool = max => {
  debug('Creating pool');
  return genericPool.createPool(factory, {
    min: 1,
    max,
    autostart: true
  });
};

module.exports = { createRedisPool };
