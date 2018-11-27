const Redis = require('ioredis');
const {
  QueueFactory, QueueFactoryError
} = require('./queueFactory');

/**
 * Registry error.
 * @extends {Error}
 */
class RegistryError extends Error {}

/**
 * Registry. Used to manage worker tasks.
 * Put tasks by calling `Registry.putTask(workerName, payload)`.
 * Pop tasks by calling `Registry.popTask(workerName)`.
 * @property {broker} broker Broker name
 * @property {Object} queueConfig Queue config which is passed to QueueFactory.create(broker, queueConfig)
 * @property {any} dbClient Database/broker connection client. Passed to Queue to reuse existent connection
 * @property {Queue[]} queues Registred queues. {[workerName]: Queue}
 */
class Registry {
  /**
   * Creates an instance of Registry.
   * Gets `BROKER` env var to create broker connection.
   */
  constructor() {
    this.broker = process.env.BROKER;
    this.queueConfig = {};

    if (this.broker === 'redis') {
      this.queueConfig.dbClient = new Redis(process.env.REDIS_URL);
      this.queueConfig.timeout = process.env.QUEUE_TIMEOUT;
    } else {
      throw new RegistryError('Unsupported broker');
    }

    this.queues = {};
  }

  /**
   * Pop task from worker's queue
   * @param {string} workerName Name of worker
   * @returns {Object} Task from registry
   */
  async popTask(workerName) {
    if (!this.queues[workerName]) {
      this.queues[workerName] = QueueFactory.create(this.broker, {
        ...this.queueConfig,
        queueName: workerName
      });
    }

    const task = await this.queues[workerName].pop();

    return task;
  }

  /**
   * Push task to registry
   * @param {string} workerName Name of worker
   * @param {any} payload Task
   */
  async pushTask(workerName, payload) {
    if (!this.queues[workerName]) {
      this.queues[workerName] = QueueFactory.create(this.broker, {
        ...this.queueConfig,
        queueName: workerName
      });
    }

    await this.queues[workerName].push(payload);
  }
}

module.exports = {
  Registry,
  RegistryError
};
