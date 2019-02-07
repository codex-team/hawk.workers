const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const debug = require('debug')('db-controller');
const mongoose = require('mongoose');
const Event = require('./models/event');

mongoose.Promise = Promise;

/**
 * Connect mongoose to database
 */
function connect() {
  return new Promise((resolve, reject) => {
    mongoose.connection.on('connected', () => {
      debug('Connection Established');
      resolve();
    });

    mongoose.connection.on('close', () => {
      debug('Connection Closed');
    });

    mongoose.connection.on('error', error => {
      reject(error);
    });

    /**
     * `mongoose.connect` always return `mongoose` even if it's not connected
     * which I consider a bug. Neither it throws an error or rejects a promise,
     * so I used a dirty trick above to actually make it throw an error if
     * not connected to mongo. It a shame claiming mongoose has Promise support
     * while it has not :(
     */
    mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true
    });
  });
}

/**
 * Save event to database
 *
 * @param {Object} obj - Event object
 * @param {string} obj.catcherType - Hawk catcher type
 * @param {Object} obj.payload - Event payload
 * @returns Promise<Object | null> - Created event
 */
async function saveEvent(obj) {
  let event = new Event(obj);

  return event.save();
}

/**
 * Close mongoose connection
 *
 * @returns Promise<void>
 */
async function close() {
  return mongoose.connection.close();
}

module.exports = {
  connect,
  saveEvent,
  close
};
