import JavascriptEventWorker from '../src';
import '../../../env-test';

describe('JavaScript event worker', () => {
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

  it('should start correctly', () => {

  });

  it('should handle events without throwing errors', () => {

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
