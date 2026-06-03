import { GridFSBucket, MongoClient, Db, connect } from 'mongodb';
import { DatabaseConnectionError } from '../workerErrors';

/**
 * How many times to retry the initial Mongo handshake before giving up
 */
const DEFAULT_RECONNECT_TRIES = 60;

/**
 * Delay between initial-handshake retries, in ms
 */
const DEFAULT_RECONNECT_INTERVAL_MS = 3000;

/**
 * Bounds how long a single attempt waits for an available server, so a retry
 * fails fast during an outage instead of hanging on the 30s driver default
 */
const SERVER_SELECTION_TIMEOUT_MS = 10000;

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
   * Sent to MongoDB on handshake; overrides any `appName` query param in the URI
   */
  private readonly appName?: string;

  /**
   * GridFSBucket object
   * Used to store files in GridFS
   */
  private gridFsBucket: GridFSBucket;

  /**
   * Creates controller instance
   *
   * @param connectionUri - mongo URI for connection
   * @param appName - MongoDB appName, defaults to `process.env.MONGO_APP_NAME`
   */
  constructor(connectionUri: string, appName?: string) {
    if (!connectionUri) {
      throw new DatabaseConnectionError('Connection URI is not specified. Check .env');
    }
    this.connectionUri = connectionUri;
    this.appName = appName ?? process.env.MONGO_APP_NAME;
  }

  /**
   * Connect to the database, retrying with a fixed backoff while the server is
   * unreachable so a worker booting during a Mongo outage waits instead of
   * crash-looping. The driver auto-recovers already-open connections on its
   * own, so this retry covers the initial handshake only.
   *
   * Tunable via MONGO_RECONNECT_TRIES (default 60) and
   * MONGO_RECONNECT_INTERVAL in ms (default 3000).
   *
   * @throws {DatabaseConnectionError} if every attempt fails
   */
  public async connect(): Promise<Db> {
    if (this.db) {
      return this.db;
    }

    const tries = Number(process.env.MONGO_RECONNECT_TRIES) || DEFAULT_RECONNECT_TRIES;
    const intervalMs = Number(process.env.MONGO_RECONNECT_INTERVAL) || DEFAULT_RECONNECT_INTERVAL_MS;

    for (let attempt = 1; attempt <= tries; attempt++) {
      try {
        this.connection = await connect(this.connectionUri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
          ...(this.appName ? { appName: this.appName } : {}),
        });
        this.db = await this.connection.db();

        return this.db;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        console.warn(`[Mongo] connect attempt ${attempt}/${tries} failed: ${message}`);

        if (attempt >= tries) {
          throw new DatabaseConnectionError(err);
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    throw new DatabaseConnectionError('Failed to connect to MongoDB');
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
  public createGridFsBucket(name: string): GridFSBucket {
    this.gridFsBucket = new GridFSBucket(this.db, {
      bucketName: name,
    });

    return this.gridFsBucket;
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
