import NotifyCheckerWorker from '../src';

// /**
//  * Testing Event
//  */
// const testEventData = {
//
// } as NotifyCheckerWorkerTask;

describe('JavascriptEventWorker', () => {
  const worker = new NotifyCheckerWorker();

  test('should have correct catcher type', () => {
    expect(worker.type).toEqual('notify/check');
  });

  test('should start correctly', async () => {
    await worker.start();
  });

  // test('should handle right messages', async () => {
  //   await worker.handle(testEventData);
  // });

  test('should finish correctly', async () => {
    await worker.finish();
  });
});
