/**
 * This file contains Queue.
 *
 * Queue is used to push tasks to workers. Workers can get tasks by calling `pop` method.
 *
 * A queue should have `push` and `pop` methods and use `Parser` methods to convert messages.
 *
 * Such structure allows us to write queues for many brokers/databases like Redis, ZeroMQ, etc.
 * You can write your own by inheriting from `Queue` and implementing `push` and `pop`.
 */

/**
 * Queue base class.
 * Used to inherit from it and create new queue for different broker, e.g. RedisQueue, ZeroMQueue.
 * Inherited Queue should implement `push` and `pop`.
 */
class Queue {
  /**
   *
   * @param {stings} queueName Queue name.
   */
  constructor(queueName) {
    this.queueName = queueName;
  }

  /**
   * Push message.
   * @param {any} msg Message to send.
   * @returns {void}
   */
  push(msg) {}

  /**
   * Pop message.
   * @returns {void}
   */
  pop() {}
}

module.exports = { Queue };
