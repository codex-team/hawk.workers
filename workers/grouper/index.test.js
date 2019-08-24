const { GrouperWorker } = require('./index');

const eventContent = {
  // eslint-disable-next-line camelcase
  projectId: '5d206f7f9aaf7c0071d64596',
  catcherType: 'errors/javascript',
  payload: {
    title: 'Hawk client catcher test',
    timestamp: '2019-08-19T19:58:12.579Z',
    backtrace: []
  }
};

describe('GrouperWorker', () => {
  let worker;

  test('should return right worker type', () => {
    expect(GrouperWorker.type).toEqual('grouper');
  });

  test('should start correctly', async () => {
    worker = new GrouperWorker();
    await worker.start();
  });

  test('should handle right messages', async () => {
    await worker.handle(eventContent);
  });

  test('should finish correctly', async () => {
    await worker.finish();
  });
});
