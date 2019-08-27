import JavascriptWorker from '../src';

const eventContent = {
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwcm9qZWN0SWQiOiI1ZDIyMTNmYTBmMjkwYzAxNDRhNjljNDYiLCJpYXQiOjE1NjQ2Nzg5MDN9.8GAVXDcXa8DRyW2oBXB9fcjT7Ed-bLg8u6WyDatfLvs',
  // eslint-disable-next-line camelcase
  catcher_type: 'errors/javascript',
  payload: { event: { message: 'Test many error' },
    revision: null,
    location: {
      url: 'http://localhost:9000/',
      origin: 'http://localhost:9000',
      host: 'localhost',
      path: '/',
      port: '9000'
    },
    timestamp: 1564948772936,
    navigator: {
      ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 YaBrowser/19.6.2.594 (beta) Yowser/2.5 Safari/537.36',
      frame: {
        width: 950,
        height: 774
      }
    }
  }
};

describe('JavascriptWorker', () => {
  const worker = new JavascriptWorker();

  test('should return right worker type', () => {
    expect(JavascriptWorker.type).toEqual('errors/javascript');
  });

  test('should start correctly', async () => {
    await worker.start();
  });

  test('should handle right messages', async () => {
    await worker.handle(eventContent);
  });

  test('should finish correctly', async () => {
    await worker.finish();
  });
});
