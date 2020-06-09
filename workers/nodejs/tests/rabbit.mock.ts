import amqp from 'amqplib';

/**
 * Amqp channel mock
 */
export const mockedAmqpChannel = {
  publish: jest.fn(),
  close: jest.fn(),
  assertQueue: jest.fn(),
  prefetch: jest.fn(),
  consume: jest.fn().mockReturnValue('mockedTag'),
  sendToQueue: jest.fn(),
};

/**
 * Connection object mock for testing work with RabbitMQ
 */
const mockedAmqpConnection = {
  createChannel: (): object => mockedAmqpChannel,
  close: jest.fn(),
};

const mockedConnect = amqp.connect as jest.Mock;

mockedConnect.mockResolvedValue(Promise.resolve(mockedAmqpConnection));
