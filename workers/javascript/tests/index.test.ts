import JavascriptWorker from '../src';
import { HawkEventJavascript } from '../types/hawk-event-javascript';

/**
 * Testing Event
 */
const testEventData = {
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwcm9qZWN0SWQiOiI1ZDIyMTNmYTBmMjkwYzAxNDRhNjljNDYiLCJpYXQiOjE1NjQ2Nzg5MDN9.8GAVXDcXa8DRyW2oBXB9fcjT7Ed-bLg8u6WyDatfLvs',
  catcherType: 'errors/javascript',
  payload: {
    title: 'TestError: Everything is fine.',
    release: null,
    timestamp: 1564948772936,
    backtrace: null,
    get: null,
    user: null,
    context: null
  }
} as HawkEventJavascript;

describe('JavascriptWorker', () => {
  const worker = new JavascriptWorker();

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
