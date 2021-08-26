jest.mock('amqplib');

const amqp = require('amqplib');

/**
 * Amqp channel mock
 */
const mockedAmqpChannel = {
  publish: jest.fn(),
  close: jest.fn(),
  assertQueue: jest.fn(),
  prefetch: jest.fn(),
  sendToQueue: jest.fn(),
  on: jest.fn(),
  consume: jest.fn().mockReturnValue('mockedTag'),
};

/**
 * Connection object mock for testing work with RabbitMQ
 */
const mockedAmqpConnection = {
  createChannel: () => mockedAmqpChannel,
  close: jest.fn(),
  on: jest.fn(),
};

const mockedConnect = amqp.connect;

mockedConnect.mockResolvedValue(Promise.resolve(mockedAmqpConnection));
