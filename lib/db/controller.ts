import { GridFSBucket, MongoClient, Db, connect } from 'mongodb';

/**
 * Database connection singleton
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
   * MongoDB connection URI
   */
  private readonly connectionUri: string;

  /**
   * GridFSBucket object
   * Used to store files in GridFS
   */
  private gridFsBucket: GridFSBucket;

  /**
   * Creates controller instance
   *
   * @param connectionUri - mongo URI for connection
   */
  constructor(connectionUri) {
    if (!connectionUri) {
      throw new Error('Connection URI is not specified. Check .env');
    }
    this.connectionUri = connectionUri;
  }

  /**
   * Connect to database
   * Requires `MONGO_DSN` environment variable to be set
   *
   * @throws {Error} if `MONGO_DSN` is not set
   */
  public async connect(): Promise<Db> {
    if (this.db) {
      return;
    }

    this.connection = await connect(this.connectionUri, {
      useNewUrlParser: true,
    });
    this.db = await this.connection.db();

    return this.db;
  }

  /**
   * Close connection
   *
   * @returns {Promise<void>}
   */
  public async close(): Promise<void> {
    this.db = null;

    if (!this.connection) {
      return;
    }

    this.gridFsBucket = null;

    return this.connection.close();
  }

  /**
   * @returns {*|null}
   */
  public getConnection(): Db {
    return this.db;
  }

  /**
   * Prepares GridFs bucket to store files
   *
   * @param {string} name - The bucket name. Defaults to 'fs'.
   */
  public createGridFsBucket(name = 'fs'): void {
    this.gridFsBucket = new GridFSBucket(this.db, {
      bucketName: name,
    });
  }

  /**
   * Returns GridFs Bucket
   *
   * @returns {GridFSBucket}
   */
  public getBucket(): GridFSBucket {
    return this.gridFsBucket;
  }
}
