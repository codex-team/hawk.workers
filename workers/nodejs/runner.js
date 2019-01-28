const { NodeJSWorker } = require('./index');

const main = async () => {
  const exitHandler = () => {
    console.log('Exiting...');
    try {
      worker.finish();
    } catch (e) {
      console.error(e);
    }
  };

  const worker = new NodeJSWorker();

  try {
    await worker.start();
    console.log(`Worker nodejs started PID:${process.pid}`);
  } catch (e) {
    console.error(e);
    exitHandler();
  }

  process.on('SIGINT', exitHandler);
  process.on('SIGTERM', exitHandler);
};

main();
