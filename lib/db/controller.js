const mongodb = require('mongodb');

/**
 * Database connection singleton
 *
 * @param {mongodb.MongoClient} connection - MongoDB connection
 * @param {mongodb.Db} db - MongoDB connection database instance
 */
class Controller {
  /**
   * Connect to database
   * Requires `MONGO_DSN` environment variable to be set
   * @returns {Promise<void>}
   * @throws {Error} if `MONGO_DSN` is not set
   */
  async connect() {
    if (this.db) {
      return;
    }

    if (!process.env.MONGO_DSN) {
      throw new Error('MONGO_DSN env variable is not set!');
    }

    this.connection = await mongodb.connect(process.env.MONGO_DSN + '/' + process.env.MONGO_DBNAME, {
      useNewUrlParser: true
    });
    this.db = await this.connection.db();
  }

  /**
   * Close connection
   *
   * @returns {Promise<void>}
   */
  async close() {
    this.db = null;

    if (!this.connection) {
      return;
    }

    return this.connection.close();
  }

  /**
   * @return {*|null}
   */
  getConnection() {
    return this.db;
  }
}

module.exports = new Controller();
