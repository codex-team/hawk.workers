import NotifyEmailWorker from '../src';

describe('NotifyEmailWorker', () => {
  const worker = new NotifyEmailWorker();

  test('should have correct catcher type', () => {
    expect(worker.type).toEqual('notify/email');
  });

  test('should start correctly', async () => {
    await worker.start();
  });

  test('should finish correctly', async () => {
    await worker.finish();
  });
});
