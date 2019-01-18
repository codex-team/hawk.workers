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
    console.log('Connection Established');
  });

  mongoose.connection.on('close', () => {
    console.log('Connection Closed');
  });

  mongoose.connection.on('error', (error) => {
    console.log('Mongoose error: ' + error);
  });

  try {
    await mongoose.connect(url);
  } catch (err) {
    console.log('ERROR when connected to mongo');
    process.exit(1);
  }
}

/**
 * Save event to dayabase
 *
 * @param {Object} obj - Event object
 * @param {string} obj.token - Hawk JWT token
 * @param {object} obj.sender - Sender info
 * @param {string} obj.sender.ip - Sender ip
 * @param {string} obj.catcher_type - Hawk catcher type
 * @param {Object} obj.payload - Event payload
 */
async function saveEvent(obj) {
  let event = new Event(obj);

  return await event.save();
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