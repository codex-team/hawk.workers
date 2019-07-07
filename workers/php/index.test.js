const { PhpWorker } = require('./index');
const { ParsingError } = require('../../lib/worker');
const { resolve } = require('path');

require('dotenv').config({ path: resolve(__dirname, '.', '.env') });

let worker;

// { "projectId": "5d206f7f9aaf7c0071d64596" }
const TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwcm9qZWN0SWQiOiI1ZDIwNmY3ZjlhYWY3YzAwNzFkNjQ1OTYiLCJpYXQiOjE1MTYyMzkwMjJ9.OpSEIe1AzeejBKqlaMfX_Jy2V24g5xqMfLpe5iyBdO8';

const TITLE_OBJ = {
  error_description: 'Some error'
};

const TIMESTAMP_OBJ = {
  http_params: {
    REQUEST_TIME: '2019-01-28T13:59:49.995Z'
  }
};

const DEBUG_STACK_OBJ = {
  debug_backtrace: [
    {
      file: 'a.php',
      line: 1,
      trace: [
        {
          line: 1,
          content: 'echo $Error'
        }
      ]
    }
  ]
};

describe('PHP Worker parsing', () => {
  beforeAll(async () => {
    worker = new PhpWorker();
    await worker.start();
  });

  afterAll(async () => {
    await worker.finish();
  });

  it('correct handle right message', async () => {
    let obj = {
      token: TOKEN,
      ...TITLE_OBJ,
      ...TIMESTAMP_OBJ,
      ...DEBUG_STACK_OBJ
    };
    let msg = { content: JSON.stringify(obj) };

    await expect(worker.handle(msg)).resolves.not.toThrowError();
  });

  it('returns right fields in payload', () => {
    let obj = { ...TITLE_OBJ, ...TIMESTAMP_OBJ, ...DEBUG_STACK_OBJ };
    let payload = worker.parseData(obj);

    expect(payload).toHaveProperty('title');
    expect(payload).toHaveProperty('timestamp');
    expect(payload).toHaveProperty('level');
    expect(payload).toHaveProperty('backtrace');
  });

  it('throwing parsing error with wrong params in message', () => {
    expect(() => {
      worker.parseData({});
    }).toThrow(ParsingError);
  });

  it('returns right backtrace when it is detected', () => {
    let payload = worker.parseData({
      ...TITLE_OBJ,
      ...TIMESTAMP_OBJ,
      ...DEBUG_STACK_OBJ
    });

    expect(payload.backtrace).toHaveLength(1);
    expect(payload.backtrace).toContainEqual({
      file: 'a.php',
      line: 1,
      sourceCode: [
        {
          line: 1,
          content: 'echo $Error'
        }
      ]
    });
  });
});
