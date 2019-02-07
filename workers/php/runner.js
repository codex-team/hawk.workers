const { PhpWorker, CriticalError } = require('.');

const main = async () => {
  const exitHandler = () => {
    console.log('Exiting...');
    try {
      worker.finish();
    } catch (e) {
      console.error(e);
    }
  };

  const worker = new PhpWorker();

  try {
    await worker.start();
    console.log(`Worker nodejs started PID:${process.pid}`);
  } catch (e) {
    if (e instanceof CriticalError) {
      console.error(e);
      exitHandler();
    } else {
      // @todo some alarm
      console.error(e);
    }
  }

  process.on('SIGINT', exitHandler);
  process.on('SIGTERM', exitHandler);
};

main();
