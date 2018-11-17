const debug = require('debug')('queue:RedisQueue');
const Redis = require('ioredis');
const { Queue } = require('./queue');
const { ParserError } = require('./parser');
const { JsonParser } = require('./parserJson');

/**
 * Simple redis queue.
 * @property {string} queueName Queue name.
 * @property {number} timeout Timeout for some redis commands like `brpop`
 * @property {Parser} parser Parser used by queue to convert messages to specified data format.
 * @property {IORedis.Redis} dbClient Redis client.
 */
class RedisQueue extends Queue {
  /**
   * Create a RedisQueue.
   * @param {string} queueName Queue name.
   * @param {number} [timeout=30] Timeout for some redis commands.
   * @param {object} [redisConfig] Redis connection config.
   * @param {Parser} [parser=JsonParser] Message parser.
   * @param {Redis} [redisClient] ioredis' client. If present used instead of creatting a new one.
   */
  constructor({
    queueName, timeout = 30, redisUrl = 'redis://127.0.0.1:6379', parser = JsonParser, dbClient = null
  }) {
    super(queueName);

    // Timeout for some commands
    this.timeout = timeout;
    // Message parser
    this.parser = parser;

    // If given redis client use it instead of creating new one
    if (dbClient instanceof Redis) {
      dbClient.info((_, data) => debug(`Using provided client\n${data}`));

      this.dbClient = dbClient;
    } else {
      try {
        debug(`Creating new Redis client ${redisUrl}`);
        this.dbClient = new Redis(redisUrl);
      } catch (e) {
        throw this._handleError(e);
      }
    }
  }

  /**
   * Pushes message to queue.
   * @param {object | Array<any> | boolean | string | number} msg Message to send.
   * @throws {Redis.ReplayError | ParserError} On error.
   * @returns {void}
   */
  async push(msg) {
    try {
      const prepared = this.parser.prepare(msg);

      await this.dbClient.lpush(this.queueName, prepared);
    } catch (e) {
      throw this._handleError(e);
    }
  }

  /**
   * Pops message from queue.
   * @throws {Redis.ReplayError | ParserError} On error.
   * @returns {void}
   */
  async pop() {
    try {
      const received = await this.dbClient.brpop(this.queueName, this.timeout);

      // Check if received something
      if (!received) {
        return null;
      }

      // reveived format: [queueName, value]. Hence received[1]
      return this.parser.parse(received[1]);
    } catch (e) {
      throw this._handleError(e);
    }
  }

  /**
   * Closes redis connection.
   * @returns {void}
   */
  quit() {
    this.dbClient.quit();
  }

  /**
   * Handles error in this class.
   * @param {Error} err Error.
   * @returns {Error} Error for user.
   */
  _handleError(err) {
    if (err instanceof Redis.ReplyError) {
      console.error('Redis client error');
    }
    if (err instanceof ParserError) {
      console.error('Error while parsing');
    }

    return err;
  }
}

module.exports = { RedisQueue };
