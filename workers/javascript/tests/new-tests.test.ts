import JavascriptEventWorker from '../src';
import '../../../env-test';
import { JavaScriptEventWorkerTask } from '../types/javascript-event-worker-task';
import { ObjectId } from 'mongodb';
import * as WorkerNames from '../../../lib/workerNames';

describe('JavaScript event worker', () => {
  const objectIdAsString = (): string => {
    return (new ObjectId()).toHexString();
  };

  const beautifiedUserAgent = {
    os: 'Windows',
    osVersion: '10.0.0',
    browser: 'Firefox',
    browserVersion: '80.0.0',
  };

  const createEventMock = ({ withUserAgent }: {withUserAgent?: boolean}): JavaScriptEventWorkerTask => {
    return {
      catcherType: 'errors/javascript',
      projectId: objectIdAsString(),
      payload: {
        title: 'Mocker event for JS event worker',
        type: 'Error',
        timestamp: Date.now(),
        addons: {
          window: {
            innerHeight: 1337,
            innerWidth: 960,
          },
          userAgent: withUserAgent && 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:80.0) Gecko/20100101 Firefox/80.0',
          url: 'https://error.hawk.so',
        },
      },
    };
  };

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
      expect.objectContaining({
        projectId: workerEvent.projectId,
        catcherType: workerEvent.catcherType,
        event: {
          ...workerEvent.payload,
          addons: {
            ...workerEvent.payload.addons,
            beautifiedUserAgent: expect.objectContaining(beautifiedUserAgent),
          },
        },
      })
    );
  });

  it('should parse source maps correctly', () => {

  });

  it('should use cache while processing source maps', () => {

  });
});
