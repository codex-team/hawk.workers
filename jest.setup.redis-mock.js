const path = require('path');
const { spawn, execSync } = require('child_process');
const net = require('net');
const { createClient } = require('redis');

/**
 * Capture a Redis URL provided by the real environment (CI service container,
 * local Redis, etc.) BEFORE .env.test is loaded.
 */
const externalRedisUrl = process.env.REDIS_URL;

require('dotenv').config({ path: path.resolve(__dirname, '.env.test') });

let redisProcess;
let redisMemoryServer;

/**
 * Provide a Redis instance for tests.
 *
 * Resolution order:
 *   1. An externally provided REDIS_URL (CI service container or local Redis).
 *   2. redis-server found in PATH — ephemeral instance on a free port.
 *   3. redis-memory-server — downloads/compiles Redis on first use (no Docker).
 */
beforeAll(async () => {
  if (externalRedisUrl) {
    return;
  }

  const started = await startRedisFromPath();

  if (started) {
    process.env.REDIS_URL = started.url;
    redisProcess = started;

    return;
  }

  const { RedisMemoryServer } = require('redis-memory-server');

  redisMemoryServer = new RedisMemoryServer({
    binary: {
      version: '6.2.14',
    },
  });

  const host = await redisMemoryServer.getHost();
  const port = await redisMemoryServer.getPort();

  process.env.REDIS_URL = `redis://${host}:${port}`;
}, 120000);

afterAll(async () => {
  if (redisProcess) {
    await redisProcess.stop();
  }

  if (redisMemoryServer) {
    await redisMemoryServer.stop();
  }
});

/**
 * @returns {Promise<{ url: string, stop: () => Promise<void> } | null>}
 */
async function startRedisFromPath() {
  const binary = findRedisServerBinary();

  if (!binary) {
    return null;
  }

  const port = await getFreePort();
  const proc = spawn(binary, [
    '--port',
    String(port),
    '--bind',
    '127.0.0.1',
    '--save',
    '',
    '--appendonly',
    'no',
  ], {
    stdio: 'ignore',
  });

  const url = `redis://127.0.0.1:${port}`;

  await waitForRedis(url);

  return {
    url,
    stop: () => stopRedisProcess(proc),
  };
}

/**
 * @returns {string | null}
 */
function findRedisServerBinary() {
  if (process.env.REDIS_SERVER_PATH) {
    return process.env.REDIS_SERVER_PATH;
  }

  try {
    return execSync('command -v redis-server', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<number>}
 */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        reject(new Error('Failed to allocate a free TCP port'));
        return;
      }

      const { port } = address;

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });

    server.on('error', reject);
  });
}

/**
 * @param {string} url
 * @returns {Promise<void>}
 */
async function waitForRedis(url) {
  const timeoutMs = 10000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const client = createClient({ url });

      await client.connect();
      await client.ping();
      await client.quit();

      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw new Error(`Redis did not become ready at ${url}`);
}

/**
 * @param {import('child_process').ChildProcess} proc
 * @returns {Promise<void>}
 */
function stopRedisProcess(proc) {
  return new Promise((resolve) => {
    if (proc.exitCode !== null) {
      resolve();
      return;
    }

    proc.once('exit', resolve);
    proc.kill('SIGTERM');

    setTimeout(() => {
      if (proc.exitCode === null) {
        proc.kill('SIGKILL');
      }

      resolve();
    }, 2000);
  });
}
