const { Worker } = require('./src/');
const debug = require('debug')('worker:test');

const w = new Worker('test', '127.0.0.1', 4000);

/**
 *
 *
 * @param {*} ms
 * @returns
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

w.on('task', task => {
  debug('done');
  w.emit('done', {
    id: 1232131,
    success: true,
    data: ''
  });
});
