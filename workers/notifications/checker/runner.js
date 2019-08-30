const dotenv = require('dotenv');
const path = require('path');

// Local config
dotenv.config({ path: path.resolve(__dirname, './.env') });

// Global config
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const { NotifyCheckerWorker } = require('./index');

const main = async () => {
  /**
   * Exit handler, called when received SIGTERM/SIGINT (Ctrl+C)
   */
  const exitHandler = () => {
    console.log('Exiting...');
    try {
      worker.finish();
    } catch (e) {
      console.error(e);
    }
  };

  /**
   * Unhandled exception handler
   * @param {Error} err - Exception
   */
  const exceptionHandler = err => {
    if (err.name === 'MongoNetworkError') {
      console.error('Mongo connection error:');
    } else {
      console.error('Uncaught exception:');
    }
    console.error(err);
    worker.logger.error(err);
    exitHandler();
  };

  const worker = new NotifyCheckerWorker();

  try {
    await worker.start();
    console.log(`Worker notify checker started PID: ${process.pid}`);
  } catch (e) {
    exceptionHandler(e);
  }

  process.on('SIGINT', exitHandler);
  process.on('SIGTERM', exitHandler);
  process.on('uncaughtException', exceptionHandler);
  process.on('unhandledRejection', exceptionHandler);
};

main();