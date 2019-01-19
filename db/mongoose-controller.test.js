const { resolve } = require('path');
const db = require('./mongoose-controller');

require('dotenv').config({path: resolve(__dirname, '..', '.env')});

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
 * MongoDB connection URL
 */
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';

/**
 * Hawk test event
 */
const TEST_EVENT = {
  token: CATCHER_TOKEN,
  sender: {ip: CATCHER_SENDER},
  /* eslint-disable-next-line */
  catcher_type: CATCHER_TYPE,
  payload: {
    message: 'ReferenceError: kek is not defined',
    type: 'ReferenceError',
    stack: 'ReferenceError: kek is not defined\n    at Timeout.namedFunc [as _onTimeout] (C:\\Users\\Nick\\GitHub\\hawk.workers\\tools\\bomber.js:11:7)\n    at listOnTimeout (timers.js:324:15)\n    at processTimers (timers.js:268:5)',
    time: new Date().toISOString(),

    // custom params
    comment: 'Test event'
  }
};

describe('DB Controller', async () => {
  it('connects to db', async () => {
    expect(db.connect(MONGO_URL)).resolves.not.toThrowError();
  });

  it('saves event', async () => {
    await expect(db.saveEvent(TEST_EVENT)).resolves.not.toThrowError();
  });

  it('closes connection', async () => {
    await expect(db.close()).resolves.not.toThrowError();
  });
});
