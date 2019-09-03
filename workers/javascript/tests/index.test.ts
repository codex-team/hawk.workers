import JavascriptEventWorker from '../src';
import {JavaScriptEventWorkerTask} from '../types/javascript-event-worker-task';

/**
 * Testing Event
 */
const testEventData = {
  projectId: '5d2213fa0f290c0144a69c46',
  catcherType: 'errors/javascript',
  payload: {
    title: 'TestError: Everything is fine.',
    release: null,
    timestamp: 1564948772936,
    backtrace: null,
    get: null,
    user: null,
    context: null,
  },
} as JavaScriptEventWorkerTask;

describe('JavascriptEventWorker', () => {
  const worker = new JavascriptEventWorker();

  test('should have correct catcher type', () => {
    expect(worker.type).toEqual('errors/javascript');
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
