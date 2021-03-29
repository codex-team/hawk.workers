import amqp from 'amqplib';

/**
 * Amqp channel mock
 */
const mockedAmqpChannel = {
  publish: jest.fn(),
  close: jest.fn(),
  assertQueue: jest.fn(),
  prefetch: jest.fn(),
  sendToQueue: jest.fn(),
  consume: jest.fn().mockReturnValue('mockedTag'),
};

/**
 * Connection object mock for testing work with RabbitMQ
 */
const mockedAmqpConnection = {
  createChannel: (): typeof mockedAmqpChannel => mockedAmqpChannel,
  close: jest.fn(),
};

const mockedConnect = amqp.connect as jest.Mock;

mockedConnect.mockResolvedValue(Promise.resolve(mockedAmqpConnection));
