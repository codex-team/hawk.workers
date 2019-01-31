const { PhpWorker } = require('./index');
const { resolve } = require('path');

require('dotenv').config({ path: resolve(__dirname, '.', '.env') });

let worker;

describe('PHP Worker parsing', () => {
  beforeAll(() => {
    worker = new PhpWorker();
  });

  it('anyway returns right fields in payload', () => {
    let payload = worker.parseData({});

    expect(payload).toHaveProperty('title');
    expect(payload).toHaveProperty('timestamp');
    expect(payload).toHaveProperty('level');
  });

  it('returns right backtrace when it is detected', () => {
    let payload = worker.parseData({
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

    expect(payload.backtrace).toHaveLength(1);
    expect(payload.backtrace).toContainEqual({
      file: 'a',
      line: 1,
      sourceCode: []
    });
  });
});