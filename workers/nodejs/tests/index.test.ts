import NodeJSEventWorker from '../src';
import { NodeJSEventWorkerTask } from '../types/nodejs-event-worker-task';
import '../../../env-test';

/**
 * Testing Event
 */
const testEventData = {
  projectId: '5d2213fa0f290c0144a69c46',
  catcherType: 'errors/nodejs',
  payload: {
    title: 'TestError: Everything is fine.',
    backtrace: null
  },
} as NodeJSEventWorkerTask;

describe('NodeJSEventWorker', () => {
  const worker = new NodeJSEventWorker();

  test('should have correct catcher type', () => {
    expect(worker.type).toEqual('errors/nodejs');
  });

  test('should start correctly', async () => {
    await worker.start();
  });

  test('should handle right messages', async () => {
    await worker.handle(testEventData);
  });

  test('should finish correctly', async () => {
    await worker.finish();
  });
});
