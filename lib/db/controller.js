const mongodb = require('mongodb');
const { eventSchema } = require('./event');

/**
 * Database connection singleton
 *
 * @param {MongoClient} connection - MongoDB connection
 */
class Controller {
  /**
   * Connect to databse
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connection) {
      return;
    }

    this.connection = await mongodb.connect(process.env.MONGO_URL, {
      useNewUrlParser: true
    });
  }
}

module.exports = Controller;
