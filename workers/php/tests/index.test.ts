import PhpEventWorker from '../src';
import '../../../env-test';

describe('PhpEventWorker', () => {
  const worker = new PhpEventWorker();

  test('should have correct catcher type', () => {
    expect(worker.type).toEqual('errors/php');
  });
});
