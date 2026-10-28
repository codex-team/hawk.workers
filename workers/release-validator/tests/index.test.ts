import { spawnSync, SpawnSyncReturns } from 'child_process';
import { resolve } from 'path';
import type { Db } from 'mongodb';
import { connect as connectRegistry } from 'amqplib';
import { DatabaseController } from '../../../lib/db/controller';
import { runReleaseValidation } from '../src';
import { validateReleases } from '../src/validate-releases';

jest.mock('../../../lib/db/controller');
jest.mock('../src/validate-releases');

const MockDatabaseController = DatabaseController as jest.MockedClass<typeof DatabaseController>;
const mockValidateReleases = validateReleases as jest.MockedFunction<typeof validateReleases>;

/**
 * Execute the real CLI against the local MongoDB started by the Jest configuration.
 *
 * @param maxDays - configured release retention period
 * @param uri - isolated test database, or an empty value to test configuration failure
 * @returns {SpawnSyncReturns<string>} process output and exit status, bounded by a timeout
 */
function runCli(maxDays: string, uri = `mongodb://127.0.0.1:55010/release-validator-cli-${process.pid}`): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [
    '-r', require.resolve('ts-node/register/transpile-only'),
    resolve(__dirname, '../src/index.ts'),
  ], {
    cwd: resolve(__dirname, '../../..'),
    env: {
      ...process.env,
      MONGO_EVENTS_DATABASE_URI: uri,
      MAX_DAYS_NUMBER: maxDays,
      MONGO_RECONNECT_TRIES: '1',
      TS_NODE_PREFER_TS_EXTS: 'true',
      REGISTRY_URL: 'amqp://127.0.0.1:1',
      LOG_LEVEL: 'info',
    },
    encoding: 'utf8',
    timeout: 10000,
  });
}

describe('One-shot release validation', () => {
  const db = {} as Db;
  const connect = jest.fn();
  const close = jest.fn();
  const originalUri = process.env.MONGO_EVENTS_DATABASE_URI;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MONGO_EVENTS_DATABASE_URI = 'mongodb://test/events';
    connect.mockResolvedValue(db);
    close.mockResolvedValue(undefined);
    mockValidateReleases.mockResolvedValue(undefined);
    MockDatabaseController.mockImplementation(() => ({
      connect,
      close,
    } as unknown as DatabaseController));
  });

  afterAll(() => {
    if (originalUri === undefined) {
      delete process.env.MONGO_EVENTS_DATABASE_URI;
    } else {
      process.env.MONGO_EVENTS_DATABASE_URI = originalUri;
    }
  });

  test('should immediately validate once and close MongoDB without connecting to RabbitMQ', async () => {
    await runReleaseValidation();

    expect(MockDatabaseController).toHaveBeenCalledWith('mongodb://test/events');
    expect(connect).toHaveBeenCalledTimes(1);
    expect(mockValidateReleases).toHaveBeenCalledTimes(1);
    expect(mockValidateReleases).toHaveBeenCalledWith(db);
    expect(close).toHaveBeenCalledTimes(1);
    expect(close.mock.invocationCallOrder[0]).toBeGreaterThan(mockValidateReleases.mock.invocationCallOrder[0]);
    expect(connectRegistry).not.toHaveBeenCalled();
  });

  test('should close MongoDB and propagate validation failures', async () => {
    const error = new Error('Project validation failed');

    mockValidateReleases.mockRejectedValueOnce(error);

    await expect(runReleaseValidation()).rejects.toBe(error);
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('should clean up after a connection failure without attempting validation', async () => {
    const error = new Error('MongoDB unavailable');

    connect.mockRejectedValueOnce(error);

    await expect(runReleaseValidation()).rejects.toBe(error);
    expect(mockValidateReleases).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('should report a cleanup failure rather than completing successfully', async () => {
    close.mockRejectedValueOnce(new Error('Could not close MongoDB'));

    await expect(runReleaseValidation()).rejects.toThrow('Could not close MongoDB');
  });
});

describe('Release validator CLI', () => {
  test('should exit successfully when there are no eligible releases, without waiting for a queue task', () => {
    const result = runCli('30');

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Release validation started');
    expect(result.stdout).toContain('0 unchecked releases in 0 projects');
    expect(result.stdout).toContain('Release validation finished');
  });

  test('should exit with code 1 for invalid retention configuration', () => {
    const result = runCli('0');
    const output = result.stdout + result.stderr;

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(output).toContain('MAX_DAYS_NUMBER must be a positive number');
    expect(output).not.toContain('Release validation finished');
  });

  test('should exit with code 1 when the database URI is missing', () => {
    const result = runCli('30', '');

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('Connection URI is not specified');
  });
});
