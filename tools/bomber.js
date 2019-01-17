/**
 * Error bomber for nodejs hawk catcher
 */

/* eslint-disable require-jsdoc*/
let request = require('request-promise-native');
/**
 * Hawk catcher url
 */
const CATCHER_URL = process.env.CATCHER_URL || 'http://localhost:3000/catcher';

/**
 * Hawk token
 */
const CATCHER_TOKEN = process.env.CATCHER_TOKEN || 'randomtoken';

/**
 * Hawk sender ip
 */
const CATCHER_SENDER = process.env.CATCHER_SENDER || '127.0.0.1';

/**
 * Cather type — nodejs
 * @constant
 */
const CATCHER_TYPE = 'errors/nodejs';

/**
 * Catches and sends exception to hawk
 *
 * @param {Error} error - Error instance
 * @param {Object} [custom={}] - Custom data to send
 * @returns Promise<void>
 */
const catchException = async (error, custom = {}) => {
  const payload = {
    message: error.name + ': ' + error.message,
    type: error.name,
    stack: error.stack,
    time: new Date().toISOString(),

    // custom params
    comment: custom.comment || ''
  };

  const data = {
    token: CATCHER_TOKEN,
    sender: {ip: CATCHER_SENDER},
    /* eslint-disable-next-line */
    catcher_type: CATCHER_TYPE,
    payload
  };

  const resp = await request.post(CATCHER_URL, {
    json: true, body: data, resolveWithFullResponse: true
  });

  if (resp.statusCode === 200) {
    console.log('Sent');
  } else {
    console.error(`Error while sending:\n${resp}`);
  }
};

const main = async () => {
  function namedFunc() {
    try {
      console.log('Do smt useful');
      /* eslint-disable-next-line */
      kek();
      return true;
    } catch (e) {
      catchException(e, {comment: 'Exception in namedFunc'}).catch(err => console.error(err));
    }
  }

  setInterval(namedFunc, parseInt(Math.random() * 1000, 10));
  setInterval(() => {
    try {
      console.log('Anon func');
      throw Error('WHOOPS');
      /* eslint-disable-next-line */
      return true;
    } catch (e) {
      catchException(e, {comment: 'Exception in anonFunc'}).catch(err => console.error(err));
    }
  }, parseInt(Math.random() * 1000, 10));
};

main();