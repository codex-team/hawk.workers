const { JavascriptWorker } = require('./index');

const main = async () => {
  /**
   * Exit handler, called when received SIGTERM/SIGINT (Ctrl+C)
   */
  let isExiting = false;
  const exitHandler = async () => {
    if (isExiting) {
      return;
    }
    isExiting = true;
    console.log('Exiting...');
    try {
      await worker.finish();
    } catch (e) {
      console.error('Error while finishing JavascriptWorker: ', e);
    }
  };

  /**
   * Unhandled exception handler
   * @param {Error} err - Exception
   */
  const exceptionHandler = err => {
    if (err.name === 'MongoNetworkError') {
      console.error('Mongo connection error:', err);
    } else {
      console.error('Uncaught exception:', err);
    }
    console.log('exceptionHandler');
    worker.logger.error(err);
    exitHandler();
  };

  const worker = new JavascriptWorker();

  try {
    await worker.start();
    console.log(`Worker javascript started PID: ${process.pid}`);
  } catch (e) {
    exceptionHandler(e);
  }
  process.on('SIGINT', () => {
    console.log('SIGINT');
    exitHandler();
  });
  process.on('SIGTERM', () => {
    console.log('SIGTERM');
    exitHandler();
  });
  process.on('uncaughtException', exceptionHandler);
  process.on('unhandledRejection', exceptionHandler);
};

main();
