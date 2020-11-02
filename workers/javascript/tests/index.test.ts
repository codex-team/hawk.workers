import { mockDBController, dbConnectMock, releasesJsQueryMock } from './mongodb.mock';
/**
 * Mock db controller
 */
jest.mock('../../../lib/db/controller', () => ({
  DatabaseController: mockDBController,
}));

import JavascriptEventWorker from '../src'; // eslint-disable-line
import { JavaScriptEventWorkerTask } from '../types/javascript-event-worker-task'; // eslint-disable-line
import '../../../env-test'; // eslint-disable-line

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

const testEventDataWithRelease = {
  projectId: '5d2213fa0f290c0144a69c46',
  catcherType: 'errors/javascript',
  payload: {
    title: 'TestError: Everything is fine.',
    release: '3fa0f290c014',
    timestamp: 1564948772936,
    backtrace: [
      {
        file: 'file:///test.js',
        line: 22,
        column: 13,
      },
    ],
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

  test('should use cache while processing sourcemaps', async () => {
    /** Handle the first event. Load release data from DB */
    await worker.handle(testEventDataWithRelease);

    /** Handle the second event as a copy of the first. Get data from the cache */
    await worker.handle(testEventDataWithRelease);

    /** Only one data loading from DB should be occured */
    expect(releasesJsQueryMock).toHaveBeenCalledTimes(1);
  });

  test('should finish correctly', async () => {
    await worker.finish();
  });
});
