const { Worker } = require('./lib/worker');

/**
 *
 *
 * @class TestWorker
 * @extends {Worker}
 */
class TestWorker extends Worker {
  /**
   * Async sleep
   *
   * @param {number} ms
   * @returns Promise
   * @memberof TestWorker
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Message handle function
   *
   * @param {Object} msg Message object from consume method
   * @param {Buffer} msg.content Message content
   * @memberof TestWorker
   */
  async handle(msg) {
    console.log(msg);
    if (msg) {
      console.log('Doing hard work');
      await this.sleep(5000);
      console.log(msg.content.toString());
      console.log('Done');
      this.channel.ack(msg);
    }
  }
}

/**
 * Main
 */
async function main() {
  const w = new TestWorker('amqp://localhost', 'test');

  process.on('SIGINT', async () => {
    console.log('Exiting...');
    try {
      await w.disconnect();
    } catch (e) {
      console.error(e);
    }
    process.exit(0);
  });

  await w.start();
}

main();
