import { Worker } from './lib/worker';

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

  /**
   * Create runner instance
   * @param {string[]} workers - workers package names
   */
  constructor(workers: string[]){
    /**
     * 1. Load workers packages
     * 2. Create instances (start)
     * 3. Observe process kill and errors to correctly finish workers
     */
    this.loadPackages()
      .then((workers) => {
        console.log('✓ Workers loaded.');
        this.constructWorkers(workers);
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
   * Dynamically loads workers through the yarn workspaces
   */
  private async loadPackages() {
    return await workers.reduce((async (accumulator, packageName) => {
      const workers = await accumulator;

      const workerClass = await import(`${packageName}`);

      workers.push(workerClass.default);

      return workers;
    }), Promise.resolve([]));
  }

  /**
   * Starts worker classes
   */
  private constructWorkers(workers){
    return workers.forEach((WorkerClass) => {
      this.workers.push(new WorkerClass());
    })
  }

  /**
   * Run workers
   */
  private async startWorkers(){
    return Promise.all(this.workers.map((async (worker) => {
      try {
        await worker.start();

        console.log(`Worker ${typeof worker} started PID: ${process.pid}`);
      } catch (startingError) {
        this.exceptionHandler(startingError);

        worker.logger.error(startingError);

        await this.stopWorker(worker);
      }
    })));
  }

  /**
   * - Error on worker starting
   * - Uncaught Exception at Runner work
   * - Unhandled Promise Rejection at Runner work
   */
  private exceptionHandler(error: Error){
    console.log('\n\n (▀̿Ĺ̯▀̿ ̿) Hawk Workers Runner: an error have been occurred');
    console.log(error.name === 'MongoNetworkError' ? 'Mongo connection error:' : 'Uncaught exception:');
    console.error(error);
    console.log('\n\n');
  }

  /**
   * Finish workers when something happened with the process
   */
  private observeProcess(){
    process.on('SIGINT', () => {
      console.log('SIGINT');

      this.finishAll();
    });
    process.on('SIGTERM', () => {
      console.log('SIGTERM');

      this.finishAll();
    });
    (process as NodeJS.EventEmitter).on('uncaughtException',async (event: {error}) => {
      this.exceptionHandler(event.error);

      await this.finishAll();

      process.exit();
    });
    process.on('unhandledRejection', async (event: {reason, promise}) => {
      this.exceptionHandler(event.reason);

      await this.finishAll();
    });
  }

  /**
   * Stops one worker
   */
  private async stopWorker(worker){
    try {
      await worker.finish();
    } catch (finishingError) {
      console.error('Error while finishing Worker: ', finishingError);
    }
  }

  /**
   * Stops all workers
   */
  private async finishAll(){
    await this.workers.forEach(( async (worker)=> {
      await this.stopWorker(worker);
    }));
  }
}

new WorkerRunner(workers);
