import NodeJSEventWorker from '../src';
import { NodeJSEventWorkerTask } from '../types/nodejs-event-worker-task';
import '../../../env-test';
import { mockedAmqpChannel } from './rabbit.mock';
jest.mock('amqplib');

/**
 * Testing Event
 */
const testEventData = {
  projectId: '5d2213fa0f290c0144a69c46',
  catcherType: 'errors/nodejs',
  payload: {
    title: 'TestError: Everything is fine.',
    type: null,
    backtrace: null,
    timestamp: 1564948772936,
  },
} as NodeJSEventWorkerTask;

describe('NodeJSEventWorker', () => {
  const worker = new NodeJSEventWorker();

  test('should start correctly', async () => {
    await worker.start();
  });

  test('should have correct catcher type', () => {
    expect(worker.type).toEqual('errors/nodejs');
  });

  test('should not handle bad event data', async () => {
    const handleEvent = async (): Promise<void> => {
      await worker.handle({} as NodeJSEventWorkerTask);
    };

    expect(handleEvent).rejects.toThrowError();
  });

  test('should handle good event data', async () => {
    await worker.handle(testEventData);

    expect(mockedAmqpChannel.sendToQueue).toHaveBeenCalledTimes(1);
  });

  test('should finish correctly', async () => {
    await worker.finish();
  });
});
