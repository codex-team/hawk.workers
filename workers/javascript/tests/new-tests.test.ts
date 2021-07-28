import JavascriptEventWorker from '../src';
import '../../../env-test';
import { JavaScriptEventWorkerTask } from '../types/javascript-event-worker-task';
import { ObjectId } from 'mongodb';
import * as WorkerNames from '../../../lib/workerNames';

describe('JavaScript event worker', () => {
  const objectIdAsString = (): string => {
    return (new ObjectId()).toHexString();
  };

  const createEventMock = (): JavaScriptEventWorkerTask => {
    return {
      catcherType: 'errors/javascript',
      projectId: objectIdAsString(),
      payload: {
        title: 'Mocker event for JS event worker',
        type: 'Error',
        timestamp: Date.now(),
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
    const workerEvent = createEventMock();

    /**
     * Act
     *
     * Handle event
     */
    await worker.handle(workerEvent);

    /**
     * Assert
     */
    expect(worker.addTask).toBeCalledTimes(1);
    expect(worker.addTask).toBeCalledWith(WorkerNames.GROUPER, {
      projectId: workerEvent.projectId,
      catcherType: workerEvent.catcherType,
      event: workerEvent.payload,
    });
  });

  it('should parse user agent correctly', () => {
    /**
     * Arrange
     */

    /**
     * Act
     */

    /**
     * Assert
     */

  });

  it('should parse source maps correctly', () => {

  });

  it('should use cache while processing source maps', () => {

  });
});
