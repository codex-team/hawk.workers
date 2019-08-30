const path = require('path');
const amqp = require('amqplib');
const randomWords = require('random-words');
const dotenv = require('dotenv');
const { EmailNotificationWorker } = require('../../../workers/notifications/email');

// Local config
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Global config
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const connect = async () => {
  console.log('::connect');
  // Connect to RabbitMQ
  const conn = await amqp.connect(process.env.REGISTRY_URL);

  console.log('::connect conn');
  // Create channel
  const channel = await conn.createChannel();

  console.log('::connect channel');

  // Assert queue exists
  await channel.assertQueue(EmailNotificationWorker.type);
  console.log('::connect assertQueue');
  return { conn, channel };
};

const close = async (conn, channel) => {
  await channel.close();
  await conn.close();
};

(async () => {
  console.log('::main');
  const { conn, channel } = await connect();

  console.log('::main connected');
  const error = `Error: ${randomWords({ min: 3, max: 10 }).join(' ')}`;

  const msg = JSON.stringify({
    to: process.env.SEND_TO,
    subject: 'New error!',
    text: error,
    html: `<code>${error}</code>`
  });

  await channel.sendToQueue(EmailNotificationWorker.type, Buffer.from(msg));
  console.info(`Sent message: ${msg}`);

  await close(conn, channel);
})();