const { PhpWorker } = require('./index');
const { resolve } = require('path');

require('dotenv').config({ path: resolve(__dirname, '.', '.env') });

let worker;

describe('PHP Worker', async () => {
  beforeAll(() => {
  	console.log('started');
    worker = new PhpWorker();
  });

  it.skip('should started successfully', async () => {
    await expect(worker.start()).resolves.not.toThrowError();
  });

  it.skip('should finished successfully', async () => {
    await expect(worker.finish()).resolves.not.toThrowError();
  });

  describe('Parsing', () => {
    beforeAll(() => {
      worker = new PhpWorker();
      worker.start();
    });

    afterAll(() => {
      worker.finish();
    });

    it('returns cascade when give wrong input', () => {
      let obj = worker.parseData({});

      expect(obj).toHaveProperty('meta');
      expect(obj).toHaveProperty('payload');
    });

    it('anyway returns right fields in payload', () => {
      let obj = worker.parseData({});

      expect(obj.payload).toHaveProperty('title');
      expect(obj.payload).toHaveProperty('timestamp');
      expect(obj.payload).toHaveProperty('level');
    });

    it('returns right backtrace when it is detected', () => {      
      let obj = worker.parseData({
        'debug_backtrace': [
          {
            file: 'a',
            line: 1
          },
          {
            any: {}
          }
        ]
      });

      expect(obj.payload.backtrace).toHaveLength(1);
      expect(obj.payload.backtrace).toContainEqual({
        file: 'a',
        line: 1
      });
    });
  });
});