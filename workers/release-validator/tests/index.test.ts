import '../../../env-test';
import ReleaseValidatorWorker from '../src';

jest.mock('amqplib');

/**
 * Release Validator worker smoke tests.
 */
describe('ReleaseValidatorWorker', () => {
  test('should use the release validator queue', () => {
    const worker = new ReleaseValidatorWorker();

    expect(worker.type).toBe('cron-tasks/release-validator');
  });
});
