const { NodeJSWorker } = require('./index');

const exitHandler = () => {
  console.log('Exiting...');
  worker.finish();
};

const worker = new NodeJSWorker();

worker.start();

process.on('SIGINT', exitHandler);
process.on('SIGTERM', exitHandler);
