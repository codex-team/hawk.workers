const mongoose = require('mongoose');
const { NodeJSWorker } = require('.');

/**
 * Test message
 */
const TEST_MSG = {
  message: 'ReferenceError: kek is not defined',
  type: 'ReferenceError',
  stack:
    'ReferenceError: kek is not defined\n    at namedFunc (/home/nick/stuff/hawk.workers/tools/nodejs/bomber.js:43:7)\n    at main (/home/nick/stuff/hawk.workers/tools/nodejs/bomber.js:61:5)\n    at Object.<anonymous> (/home/nick/stuff/hawk.workers/tools/nodejs/bomber.js:71:1)\n    at Module._compile (internal/modules/cjs/loader.js:736:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:747:10)\n    at Module.load (internal/modules/cjs/loader.js:628:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:568:12)\n    at Function.Module._load (internal/modules/cjs/loader.js:560:3)\n    at Function.Module.runMain (internal/modules/cjs/loader.js:801:12)\n    at executeUserCode (internal/bootstrap/node.js:526:15)',
  time: '2019-01-28T13:59:49.995Z',
  context: 'Exception in namedFunc'
};

/**
 * Valid parsed backtrace
 */
const BACKTRACE_VALID = [
  {
    func: 'namedFunc',
    file: '/home/nick/stuff/hawk.workers/tools/nodejs/bomber.js',
    line: 43,
    pos: 7
  },
  {
    func: 'main',
    file: '/home/nick/stuff/hawk.workers/tools/nodejs/bomber.js',
    line: 61,
    pos: 5
  },
  {
    func: 'Object.<anonymous>',
    file: '/home/nick/stuff/hawk.workers/tools/nodejs/bomber.js',
    line: 71,
    pos: 1
  },
  {
    func: 'Module._compile',
    file: 'internal/modules/cjs/loader.js',
    line: 736,
    pos: 30
  },
  {
    func: 'Object.Module._extensions..js',
    file: 'internal/modules/cjs/loader.js',
    line: 747,
    pos: 10
  },
  {
    func: 'Module.load',
    file: 'internal/modules/cjs/loader.js',
    line: 628,
    pos: 32
  },
  {
    func: 'tryModuleLoad',
    file: 'internal/modules/cjs/loader.js',
    line: 568,
    pos: 12
  },
  {
    func: 'Function.Module._load',
    file: 'internal/modules/cjs/loader.js',
    line: 560,
    pos: 3
  },
  {
    func: 'Function.Module.runMain',
    file: 'internal/modules/cjs/loader.js',
    line: 801,
    pos: 12
  },
  {
    func: 'executeUserCode',
    file: 'internal/bootstrap/node.js',
    line: 526,
    pos: 15
  }
];

describe('NodeJSWorker', async () => {
  const worker = new NodeJSWorker();

  it('should parse backtrace', async () => {
    const parsed = await worker.parseTrace(TEST_MSG.stack);

    expect(parsed).toEqual(BACKTRACE_VALID);
  });
});
