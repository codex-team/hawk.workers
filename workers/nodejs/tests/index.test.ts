import NodeJSEventWorker from '../src';
import { NodeJSEventWorkerTask } from '../types/nodejs-event-worker-task';
import '../../../env-test';
import { mockedAmqpChannel } from "./rabbit.mock";
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
  },
} as NodeJSEventWorkerTask;

describe('NodeJSEventWorker', () => {
  const worker = new NodeJSEventWorker();

  test('should have correct catcher type', () => {
    expect(worker.type).toEqual('errors/nodejs');
  });

  test('should not handle bad data', async () => {
    const handleEvent = async (): Promise<void> => {
      await worker.handle({} as NodeJSEventWorkerTask);
    };

    await expect(handleEvent).rejects.toThrowError();
  });

  test('should handle right messages', async () => {
    await worker.handle(testEventData);

    expect(mockedAmqpChannel.sendToQueue).toHaveBeenCalledTimes(1);
  });
});
