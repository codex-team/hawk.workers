const Queue = require('./queue');
const { RedisQueue } = require('./queueRedis');

/**
 * Queue Factory error class
 */
class QueueFactoryError extends Error {}

/**
 * Queue factory
 */
const QueueFactory = {
  /**
   *  Map of queue: <Queue name, Queue class>
   */
  _registred: new Map([ ['redis', RedisQueue] ]),

  /**
   * Register new broker
   * @param {string} brokerName Broker name
   * @param {Queue} queueClass Queue class corresponding to specified broker
   * @throws {QueueFactoryError} if broker already exists
   */
  register(brokerName, queueClass) {
    if (!this._registred.has(brokerName) && queueClass instanceof Queue) {
      this._registred.add(brokerName, queueClass);
    } else {
      throw new QueueFactoryError('Broker already exists');
    }
  },

  /**
   * Create queue using specified broker
   * @param {string} brokerName Broker
   * @param {Object} config Config for particular Queue
   * @returns {Queue} Queue
   */
  create(brokerName, config) {
    if (!this._registred.has(brokerName)) {
      throw new QueueFactoryError('No such broker');
    }

    let QueueBroker = this._registred.get(brokerName);

    return new QueueBroker(config);
  }
};

module.exports = {
  QueueFactory,
  QueueFactoryError
};
