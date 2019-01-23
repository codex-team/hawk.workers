const { resolve } = require('path');
const { Error: MongooseError } = require('mongoose');
const db = require('./mongoose-controller');

require('dotenv').config({ path: resolve(__dirname, '..', '.env') });

/**
 * Hawk token
 */
const CATCHER_TOKEN = process.env.CATCHER_TOKEN || 'randomtoken';

/**
 * Cather type — nodejs
 * @constant
 */
const CATCHER_TYPE = 'errors/nodejs';

/**
 * MongoDB connection URL
 */
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/hawk-dev';

/**
 * Hawk test event
 */
const TEST_EVENT = {
  token: CATCHER_TOKEN,
  /* eslint-disable-next-line */
  catcher_type: CATCHER_TYPE,
  payload: {
    message: 'ReferenceError: kek is not defined',
    type: 'ReferenceError',
    stack:
      'ReferenceError: kek is not defined\n' +
      '    at Timeout.namedFunc [as _onTimeout] (C:\\Users\\Nick\\GitHub\\hawk.workers\\tools\\bomber.js:11:7)\n' +
      '    at listOnTimeout (timers.js:324:15)\n' +
      '    at processTimers (timers.js:268:5)',
    timestamp: new Date().toISOString(),

    // custom params
    comment: 'Test event'
  }
};

describe('DB Controller', async () => {
  it('should connect to db', async () => {
    expect.assertions(1);
    await expect(db.connect(MONGO_URL)).resolves.not.toThrowError();
  });

  it('should save event', async () => {
    expect.assertions(1);
    await expect(db.saveEvent(TEST_EVENT)).resolves.not.toThrowError();
  });

  it('should throw validation error on bad data', async () => {
    expect.assertions(3);
    let badEvent = TEST_EVENT;

    badEvent.payload.timestamp = 'notadate';

    try {
      await db.saveEvent(badEvent);
    } catch (err) {
      console.log(err);
      await expect(err).toBeInstanceOf(MongooseError.ValidationError);
      await expect(err.errors['payload.timestamp'].value).toBe(
        badEvent.payload.timestamp
      );
      await expect(err.errors['payload.timestamp'].name).toBe('CastError');
    }
  });

  it('should close connection', async () => {
    expect.assertions(1);
    await expect(db.close()).resolves.not.toThrowError();
  });
});
