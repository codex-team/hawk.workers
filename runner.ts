import * as utils from './lib/utils';

/* Prometheus client for pushing metrics to the pushgateway */
// import os from 'os';
// import * as promClient from 'prom-client';
// import gcStats from 'prometheus-gc-stats';
// import { nanoid } from 'nanoid';
// import * as url from 'url';
import { Worker } from './lib/worker';
import HawkCatcher from '@hawk.so/nodejs';
import * as dotenv from 'dotenv';
import { startMetricsPushing } from './lib/metrics';

dotenv.config();

if (process.env.HAWK_CATCHER_TOKEN) {
  HawkCatcher.init(process.env.HAWK_CATCHER_TOKEN);
}

type WorkerConstructor = new () => Worker;

const BEGINNING_OF_ARGS = 2;
/**
 * Get worker name(s) from command line arguments
 *
 * @example ts-node runner.ts hawk-worker-javascript
 * @example ts-node runner.ts hawk-worker-javascript hawk-worker-nodejs
 */
const workerNames = process.argv.slice(BEGINNING_OF_ARGS);

/**
 * Workers dispatcher.
 * Load, run and finish workers.
 */
class WorkerRunner {
  /**
   * Dispatched workers list
   */
  private workers: Worker[] = [];

  // private gateway?: promClient.Pushgateway;

  /**
   * Metrics push cleanup callback.
   */
  private stopMetricsPushing?: () => void;

  /**
   * Create runner instance
   */
  constructor() {
    /**
     * 1. Load workers packages
     * 2. Create instances (start)
     * 3. Observe process kill and errors to correctly finish workers
     */
    this.loadPackages()
      .then((workerConstructors) => {
        this.constructWorkers(workerConstructors);
      })
      .then(() => {
        return this.startWorkers();
      })
      .then(() => {
        try {
          this.startMetrics();
        } catch (e) {
          HawkCatcher.send(e);
          console.error(`Metrics not started: ${e}`);
        }
      })
      .then(() => {
        this.observeProcess();
      })
      .catch((loadingError) => {
        HawkCatcher.send(loadingError);
        console.error('Worker loading error: ', loadingError);
      });
  }

  /**
   * Run metrics exporter
   */
  private startMetrics(): void {
    if (!process.env.PROMETHEUS_PUSHGATEWAY_URL) {
      return;
    }

    if (this.workers.length === 0) {
      return;
    }

    const workerTypes = Array.from(new Set(this.workers.map((worker) => {
      return worker.type.replace('/', '_');
    })));

    const workerTypeForMetrics = workerTypes.length === 1 ? workerTypes[0] : 'multi_worker_process';

    if (workerTypes.length > 1) {
      console.warn(`[metrics] ${workerTypes.length} workers are running in one process; pushing metrics as "${workerTypeForMetrics}" to avoid duplicated attribution`);
    }

    this.stopMetricsPushing = startMetricsPushing(workerTypeForMetrics);
  }

  /**
   * Dynamically loads workers through the yarn workspaces
   */
  private async loadPackages(): Promise<WorkerConstructor[]> {
    return workerNames.reduce(async (accumulator, packageName) => {
      const workers = await accumulator;

      const workerClass = (await import(`${packageName}/src`)) as { default: WorkerConstructor };

      workers.push(workerClass.default);

      return workers;
    }, Promise.resolve([] as WorkerConstructor[]));
  }

  /**
   * Starts worker classes
   *
   * @param workerConstructors - worker constructors to create new instances
   */
  private constructWorkers(workerConstructors: WorkerConstructor[]): void {
    return workerConstructors.forEach((WorkerClass) => {
      try {
        const worker = new WorkerClass();

        this.workers.push(worker);
      } catch (error) {
        console.error('Error constructing worker', error);
      }
    });
  }

  /**
   * Run workers
   */
  private async startWorkers(): Promise<void[]> {
    return Promise.all(
      this.workers.map(async (worker) => {
        try {
          await worker.start();

          console.log(
            '\x1b[32m%s\x1b[0m',
            `\n\n( ಠ ͜ʖರೃ) Worker ${worker.constructor.name} started with pid ${process.pid} \n`
          );

          utils.sendReport(worker.constructor.name + ' started');
        } catch (startingError) {
          this.exceptionHandler(startingError);

          utils.sendReport(worker.constructor.name + ' failed to start');

          await this.stopWorker(worker);
        }
      })
    );
  }

  /**
   * - Error on worker starting
   * - Uncaught Exception at Runner work
   * - Unhandled Promise Rejection at Runner work
   *
   * @param error - error to handle
   */
  private exceptionHandler(error: Error): void {
    HawkCatcher.send(error);

    console.log(
      '\x1b[41m%s\x1b[0m',
      '\n\n (▀̿Ĺ̯▀̿ ̿) Hawk Workers Runner: an error has been occurred: \n'
    );
    console.log(error);
    if (error === undefined) {
      console.trace();
    }
    console.log('\n\n');

    const workerConstructorNames = this.workers.map(worker => worker.constructor.name).join(', ');

    utils.sendReport(`${workerConstructorNames}: Error has been occurred: ${error ? error.message : 'unknown'}`);
  }

  /**
   * Finish workers when something happened with the process
   */
  private observeProcess(): void {
    process.on('SIGINT', async () => {
      console.log('SIGINT');

      await this.finishAll();

      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      console.log('SIGTERM');

      await this.finishAll();

      process.exit();
    });
    process.on('exit', () => {
      console.log('exitting...');

      process.kill(process.pid, 'SIGTERM');
    });
    (process as NodeJS.EventEmitter).on(
      'uncaughtException',
      async (event) => {
        this.exceptionHandler(event as Error);

        await this.finishAll();

        process.exit();
      }
    );
    process.on('unhandledRejection', async (event) => {
      this.exceptionHandler(event as Error);

      await this.finishAll();

      process.exit();
    });
  }

  /**
   * Stops one worker
   *
   * @param worker - worker instance to stop
   */
  private async stopWorker(worker: Worker): Promise<void> {
    try {
      // stop pushing metrics
      this.stopMetricsPushing?.();
      this.stopMetricsPushing = undefined;
      await worker.finish();

      console.log(
        '\x1b[33m%s\x1b[0m',
        `\n\n Worker ${worker.constructor.name} stopped \n`
      );
    } catch (finishingError) {
      HawkCatcher.send(finishingError);
      console.error('Error while finishing Worker: ', finishingError);
    }
  }

  /**
   * Stops all workers
   */
  private async finishAll(): Promise<void[]> {
    return Promise.all(
      this.workers.map(async (worker) => {
        return this.stopWorker(worker);
      })
    );
  }
}

try {
  // eslint-disable-next-line no-new
  new WorkerRunner();
} catch (error) {
  console.error('Error running worker runner', error);
}
