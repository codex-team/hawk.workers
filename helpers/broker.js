const Redis = require('ioredis');

let brokerClient;

const getBrokerClient = () => {
  if (!brokerClient) {
    if (process.env.BROKER === 'redis') {
      brokerClient = new Redis(process.env.REDIS_URL);
    }
  }
  return brokerClient;
};

module.exports = getBrokerClient();
