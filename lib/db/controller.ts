import * as mongodb from 'mongodb';
import {GridFSBucket, MongoClient} from 'mongodb';
import {Db} from 'mongodb';

/**
 * Database connection singleton
 *
 * @param {mongodb.MongoClient} connection - MongoDB connection
 * @param {mongodb.Db} db - MongoDB connection database instance
 */
export class DatabaseController {
  /**
   * MongoDB client
   */
  private db: Db;

  /**
   * Mongo connection
   */
  private connection: MongoClient;

  /**
   * GridFSBucket object
   * Used to store files in GridFS
   */
  private gridFsBucket: GridFSBucket;

  /**
   * Connect to database
   * Requires `MONGO_DSN` environment variable to be set
   *
   * @param {string} dbName - database name
   *
   * @returns {Promise<void>}
   * @throws {Error} if `MONGO_DSN` is not set
   */
  public async connect(dbName: string) {
    if (this.db) {
      return;
    }

    if (!process.env.MONGO_DSN) {
      throw new Error('MONGO_DSN env variable is not set!');
    }

    if (!dbName) {
      throw new Error('Database name is not specified. Check .env');
    }

    this.connection = await mongodb.connect(process.env.MONGO_DSN + '/' + dbName, {
      useNewUrlParser: true,
    });
    this.db = await this.connection.db();
  }

  /**
   * Close connection
   *
   * @returns {Promise<void>}
   */
  public async close() {
    this.db = null;

    if (!this.connection) {
      return;
    }

    this.gridFsBucket = null;

    return this.connection.close();
  }

  /**
   * @return {*|null}
   */
  public getConnection() {
    return this.db;
  }

  /**
   * Prepares GridFs bucket to store files
   * @param {string} name - The bucket name. Defaults to 'fs'.
   */
  public createGridFsBucket(name = 'fs') {
    this.gridFsBucket = new mongodb.GridFSBucket(this.db, {
      bucketName: name,

    });
  }

  /**
   * Returns GridFs Bucket
   * @return {GridFSBucket}
   */
  public getBucket() {
    return this.gridFsBucket;
  }
}
