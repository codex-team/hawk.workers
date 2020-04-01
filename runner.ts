/* tslint:disable:no-shadowed-variable  */
import * as utils from './lib/utils';

/* Prometheus client for pushing metrics to the pushgateway */
import promClient from 'prom-client';
import url = from 'url';

/**
 * Get worker name(s) from command line arguments
 *
 * @example ts-node runner.ts hawk-worker-javascript
 * @example ts-node runner.ts hawk-worker-javascript hawk-worker-nodejs
 */
const workers = process.argv.slice(2);

/**
 * Workers dispatcher.
 * Load, run and finish workers.
 */
class WorkerRunner {
  /**
   * Dispatched workers list
   */
  private workers: any[] = [];

  private gateway: any;

  /**
   * Create runner instance
   * @param {string[]} workers - workers package names
   */
  constructor(workers: string[]) {
    /**
     * 1. Load workers packages
     * 2. Create instances (start)
     * 3. Observe process kill and errors to correctly finish workers
     */
    this.loadPackages()
      .then((workers) => {
        this.constructWorkers(workers);
      })
      .then(() => {
        try {
          this.startMetrics();
        } catch (e) {
          console.error(`Metrics not started: ${e}`);
        }
        return Promise.resolve();
      })
      .then(() => {
        return this.startWorkers();
      })
      .then(() => {
        this.observeProcess();
      })
      .catch((loadingError) => {
        console.error('Worker loading error: ', loadingError);
      });
  }

  /**
   * Run metrics exporter
   */
  private startMetrics() {
    if (!process.env.PROMETHEUS_PUSHGATEWAY) {
      return;
    }

    this.gateway = new promClient.Pushgateway(process.env.PROMETHEUS_PUSHGATEWAY);
    
    const collectDefaultMetrics = promClient.collectDefaultMetrics;
    const Registry = promClient.Registry;
    const register = new Registry();
    const instance = url.parse(process.env.PROMETHEUS_PUSHGATEWAY).host;

    // Initialize metrics for workers
    this.workers.forEach((worker) => {
      worker.initMetrics();
      worker.getMetrics().forEach((metric) => register.registerMetric(metric));
    });

    collectDefaultMetrics({ register });

    console.log(`Start pushing metrics to ${process.env.PROMETHEUS_PUSHGATEWAY}`);

    // Pushing metrics to the pushgateway every second
    setInterval(() => {
      this.workers.forEach((worker) => {
        this.gateway.push({
          jobName: 'workers',
          groupings: {
            type: worker.type.replace("/", "_"),
            instance: instance,
          }
        }, (err, resp, body) => {
          if (err) { console.log(`Error of pushing metrics to gateway: ${err}`); }
        });
      });
    }, 1000);
  }

  /**
   * Dynamically loads workers through the yarn workspaces
   */
  private async loadPackages() {
    return await workers.reduce(async (accumulator, packageName) => {
      const workers = await accumulator;

      const workerClass = await import(`${packageName}`);

      workers.push(workerClass.default);

      return workers;
    }, Promise.resolve([]));
  }

  /**
   * Starts worker classes
   */
  private constructWorkers(workers) {
    return workers.forEach((WorkerClass) => {
      this.workers.push(new WorkerClass());
    });
  }

  /**
   * Run workers
   */
  private async startWorkers() {
    return Promise.all(
      this.workers.map(async (worker) => {
        try {
          await worker.start();

          console.log(
            '\x1b[32m%s\x1b[0m',
            `\n\n( ಠ ͜ʖರೃ) Worker ${worker.constructor.name} started with pid ${process.pid} \n`,
          );

          utils.sendReport(worker.constructor.name + ' started');

        } catch (startingError) {
          this.exceptionHandler(startingError);

          utils.sendReport(worker.constructor.name + ' failed to start');

          worker.logger.error(startingError);

          await this.stopWorker(worker);
        }
      }),
    );
  }

  /**
   * - Error on worker starting
   * - Uncaught Exception at Runner work
   * - Unhandled Promise Rejection at Runner work
   */
  private exceptionHandler(error: Error) {
    console.log(
      '\x1b[41m%s\x1b[0m',
      '\n\n (▀̿Ĺ̯▀̿ ̿) Hawk Workers Runner: an error has been occurred: \n',
    );
    console.log(error);
    if (error === undefined) {
      console.trace();
    }
    console.log('\n\n');

    utils.sendReport('Error has been occurred: ' + (error ? error.message : 'unknown') );
  }

  /**
   * Finish workers when something happened with the process
   */
  private observeProcess() {
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
      },
    );
    process.on('unhandledRejection', async (event) => {
      this.exceptionHandler(event as Error);

      await this.finishAll();

      process.exit();
    });
  }

  /**
   * Stops one worker
   */
  private async stopWorker(worker) {
    try {
      await worker.finish();

      console.log(
        '\x1b[33m%s\x1b[0m',
        `\n\n Worker ${worker.constructor.name} stopped \n`,
      );
    } catch (finishingError) {
      console.error('Error while finishing Worker: ', finishingError);
    }
  }

  /**
   * Stops all workers
   */
  private async finishAll() {
    return Promise.all(
      this.workers.map(async (worker) => {
        return await this.stopWorker(worker);
      }),
    );
  }
}

// tslint:disable-next-line: no-unused-expression
new WorkerRunner(workers);
