import JavascriptEventWorker from '../src';
import '../../../env-test';
import { JavaScriptEventWorkerTask } from '../types/javascript-event-worker-task';
import { Db, MongoClient, ObjectId } from 'mongodb';
import * as WorkerNames from '../../../lib/workerNames';
import { ReleaseDBScheme } from 'hawk.types';

describe('JavaScript event worker', () => {
  let connection: MongoClient;
  let db: Db;

  /**
   * Returns new ObjectId as string
   */
  const objectIdAsString = (): string => {
    return (new ObjectId()).toHexString();
  };

  /**
   * Parsed user agent for comparing
   */
  const beautifiedUserAgent = {
    os: 'Windows',
    osVersion: '10.0.0',
    browser: 'Firefox',
    browserVersion: '80.0.0',
  };

  /**
   * Creates event object for JS worker
   *
   * @param withUserAgent - is event with user agent
   * @param withBacktrace - is event with backtrace
   */
  const createEventMock = ({ withUserAgent, withBacktrace }: {withUserAgent?: boolean, withBacktrace?: boolean}): JavaScriptEventWorkerTask => {
    return {
      catcherType: 'errors/javascript',
      projectId: objectIdAsString(),
      payload: {
        title: 'Mocked event for JS event worker',
        type: 'Error',
        timestamp: Date.now(),
        release: '3fa0f290c014',
        addons: {
          window: {
            innerHeight: 1337,
            innerWidth: 960,
          },
          userAgent: withUserAgent && 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:80.0) Gecko/20100101 Firefox/80.0',
          url: 'https://error.hawk.so',
        },
        backtrace: withBacktrace && [
          {
            file: 'file:///main.js',
            line: 1,
            column: 4,
          },
          {
            file: 'file:///static/js/second.js',
            line: 2,
            column: 3,
          },
        ],
      },
    };
  };

  /**
   * Creates release object
   *
   * @param projectId - for what project is this release
   * @param release - release id
   */
  const createReleaseMock = ({ projectId, release }: { projectId: string, release: string }): ReleaseDBScheme => {
    return {
      _id: new ObjectId(),
      projectId,
      release,
      commits: [],
      files: [
        {
          mapFileName: 'main.js.map',
          originFileName: 'main.js',
          _id: new ObjectId(),
        },
        {
          mapFileName: 'second.js.map',
          originFileName: 'static/js/second.js',
          _id: new ObjectId(),
        },
      ],
    };
  };

  beforeAll(async () => {
    connection = await MongoClient.connect(process.env.MONGO_EVENTS_DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    db = connection.db('hawk');
  });

  it('should have correct catcher type', () => {
    /**
     * Arrange
     */
    const worker = new JavascriptEventWorker();

    /**
     * Act
     */
    const workerType = worker.type;

    /**
     * Assert
     */
    expect(workerType).toEqual('errors/javascript');
  });

  it('should start correctly', async () => {
    /**
     * Arrange
     */
    const worker = new JavascriptEventWorker();

    /**
     * Act
     *
     * Start worker
     */
    await worker.start();

    /**
     * Assert
     *
     * No errors
     */
    await worker.finish();
  });

  it('should finish correctly', async () => {
    /**
     * Arrange
     */
    const worker = new JavascriptEventWorker();

    await worker.start();

    /**
     * Act
     *
     * Finish worker
     */
    await worker.finish();

    /**
     * Assert
     *
     * No errors
     */
  });

  it('should handle event and add task to grouper', async () => {
    /**
     * Arrange
     */
    const worker = new JavascriptEventWorker();

    jest.spyOn(worker, 'addTask');
    await worker.start();
    const workerEvent = createEventMock({});

    /**
     * Act
     *
     * Handle event
     */
    await worker.handle(workerEvent);

    /**
     * Assert
     */
    expect(worker.addTask).toHaveBeenCalledTimes(1);
    expect(worker.addTask).toHaveBeenCalledWith(
      WorkerNames.GROUPER,
      expect.objectContaining({
        projectId: workerEvent.projectId,
        catcherType: workerEvent.catcherType,
        event: workerEvent.payload,
      })
    );
    await worker.finish();
  });

  it('should parse user agent correctly', async () => {
    /**
     * Arrange
     */
    const worker = new JavascriptEventWorker();

    jest.spyOn(worker, 'addTask');
    await worker.start();
    const workerEvent = createEventMock({ withUserAgent: true });

    /**
     * Act
     *
     * Handle event
     */
    await worker.handle(workerEvent);

    /**
     * Assert
     */
    expect(worker.addTask).toHaveBeenCalledTimes(1);
    expect(worker.addTask).toHaveBeenCalledWith(
      WorkerNames.GROUPER,
      {
        projectId: workerEvent.projectId,
        catcherType: workerEvent.catcherType,
        event: {
          ...workerEvent.payload,
          addons: {
            ...workerEvent.payload.addons,
            beautifiedUserAgent: expect.objectContaining(beautifiedUserAgent),
          },
        },
      }
    );
    await worker.finish();
  });

  it('should parse source maps correctly', () => {
    /**
     * This test will check source maps parsing
     */
  });

  it('should use cache while processing source maps', async () => {
    /**
     * Arrange
     */
    const worker = new JavascriptEventWorker();

    await worker.start();
    jest.spyOn(worker.releasesDbCollection, 'findOne');

    const workerEvent = createEventMock({ withBacktrace: true });
    const release = createReleaseMock({
      projectId: workerEvent.projectId,
      release: workerEvent.payload.release,
    });

    await db.collection('releases').insertOne(release);

    /**
     * Act
     *
     * Handle event twice
     */
    await worker.handle(workerEvent);
    await worker.handle(workerEvent);

    /**
     * Assert
     *
     * Did only one request to database
     */
    expect(worker.releasesDbCollection.findOne).toHaveBeenCalledTimes(1);
    await worker.finish();
  });

  afterAll(async () => {
    await connection.close();
  });
});
