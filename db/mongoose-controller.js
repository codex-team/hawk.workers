const debug = require('debug')('db-controller');
const mongoose = require('mongoose');
const Event = require('./models/event');

mongoose.Promise = Promise;

/**
 * Connect mongoose to database
 *
 * @param {string} url - MongoDB connection URL
 */
async function connect(url) {
  mongoose.connection.on('connected', () => {
    debug('Connection Established');
  });

  mongoose.connection.on('close', () => {
    debug('Connection Closed');
  });

  mongoose.connection.on('error', error => {
    debug('Mongoose error: ' + error);
  });

  try {
    await mongoose.connect(url);
  } catch (err) {
    debug('ERROR when connected to mongo');
    process.exit(1);
  }
}

/**
 * Save event to database
 *
 * @param {Object} obj - Event object
 * @param {string} obj.token - Hawk JWT token
 * @param {string} obj.catcher_type - Hawk catcher type
 * @param {Object} obj.payload - Event payload
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
