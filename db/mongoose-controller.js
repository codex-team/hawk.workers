const mongoose = require('mongoose');
const Event = require('./models/event');

mongoose.Promise = Promise;

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

async function saveEvent(obj) {
  let event = new Event(obj);

  await Event.save(event);
}

async function close() {
  mongoose.connection.close();
}

module.exports = {
  connect,
  saveEvent,
  close
};