import NotifyCheckerWorker from '../src';

describe('NotifyCheckerWorker', () => {
  const worker = new NotifyCheckerWorker();

  test('should have correct catcher type', () => {
    expect(worker.type).toEqual('notify/check');
  });

  test('should start correctly', async () => {
    await worker.start();
  });

  test('should finish correctly', async () => {
    await worker.finish();
  });
});
