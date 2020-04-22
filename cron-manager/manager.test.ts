import CronManager from './manager';
import { CronManagerConfig } from './types';
import amqp from 'amqplib';
import waitForExpect from 'wait-for-expect';

jest.mock('amqplib');

/**
 * CronManager config for testing
 */
const testConfig: CronManagerConfig = {
  tasks: [
    {
      workerName: 'testWorkerName',
      schedule: '* * * * * *',
    },
  ],
};

/**
 * Amqp channel mock
 */
const mockedAmqpChannel = {
  sendToQueue: jest.fn(),
  close: jest.fn(),
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

describe('CronManager', () => {
  let cronManager: CronManager;

  it('should initialized correctly', () => {
    cronManager = new CronManager('ampq://fake', testConfig);
  });

  it('should start correctly', async () => {
    await cronManager.start();
    expect(mockedConnect).toHaveBeenCalledTimes(1);
  });

  it('should correctly add tasks to the queue', async () => {
    await waitForExpect(() => {
      expect(mockedAmqpChannel.sendToQueue).toHaveBeenCalled();
    }, 2000);
  });

  it('should stop correctly', async () => {
    await cronManager.stop();
    expect(mockedAmqpConnection.close).toHaveBeenCalledTimes(1);
    expect(mockedAmqpChannel.close).toHaveBeenCalledTimes(1);
  });
});
