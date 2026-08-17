import { ChannelType } from 'hawk-worker-notifier/types/channel';
import * as amqp from 'amqplib';
import HawkCatcher from '@hawk.so/nodejs';
import { DatabaseController } from '../../../lib/db/controller';
import createLogger from '../../../lib/logger';
import * as pkg from '../package.json';
import './env';
import ChannelSenderWorker from './channel-sender';
import channelProviders from './channels';

/**
 * Multi-channel sender worker: starts a ChannelSenderWorker per enabled channel.
 * Channels are set by SENDER_CHANNELS (comma-separated, all by default),
 * each consumes its own `sender/<channel>` queue through its own channel of the shared
 * Registry connection. MongoDB connections are shared too.
 */
export default class SenderWorker {
  /**
   * Worker type. Used for metrics and logs
   */
  public readonly type: string = pkg.workerType;

  /**
   * Logger module
   */
  private logger = createLogger();

  /**
   * Database Controllers shared between channel workers
   */
  private eventsDb = new DatabaseController(process.env.MONGO_EVENTS_DATABASE_URI);
  private accountsDb = new DatabaseController(process.env.MONGO_ACCOUNTS_DATABASE_URI);

  /**
   * Workers of enabled channels
   */
  private channelWorkers: ChannelSenderWorker[];

  /**
   * Connection to Registry shared between channel workers
   */
  private registryConnection: amqp.Connection;

  /**
   * Checks required ENV params and creates channel workers
   */
  constructor() {
    if (!process.env.GARAGE_URL) {
      throw Error('process.env.GARAGE_URL does not specified. Check workers/sender/.env');
    }

    if (!process.env.API_STATIC_URL) {
      throw Error('process.env.API_STATIC_URL does not specified. Check workers/sender/.env');
    }

    this.channelWorkers = this.getEnabledChannels().map((channel) => {
      return new ChannelSenderWorker(channel, new channelProviders[channel](), this.eventsDb, this.accountsDb);
    });
  }

  /**
   * Connect to databases and Registry and start consuming channel queues.
   * Waits for every start attempt to settle so that a failure of one channel
   * cannot race with the runner cleanup while other channels are still connecting
   */
  public async start(): Promise<void> {
    await this.eventsDb.connect();
    await this.accountsDb.connect();

    await this.connectToRegistry();

    const results = await Promise.allSettled(this.channelWorkers.map((worker) => worker.start()));
    const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');

    if (failed) {
      throw failed.reason;
    }

    this.logger.info(`Sender started with channels: ${this.channelWorkers.map((worker) => worker.type).join(', ')}`);
  }

  /**
   * Finish channel workers and close Registry and database connections.
   * Connections are closed only after every channel finish attempt settles
   */
  public async finish(): Promise<void> {
    const results = await Promise.allSettled(this.channelWorkers.map((worker) => worker.finish()));

    if (this.registryConnection) {
      await this.registryConnection.close();
    }

    await this.eventsDb.close();
    await this.accountsDb.close();

    const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');

    if (failed) {
      throw failed.reason;
    }
  }

  /**
   * Open one Registry connection for all channel workers.
   * Each of them opens its own channel inside it, so prefetch stays per channel
   */
  private async connectToRegistry(): Promise<void> {
    this.registryConnection = await amqp.connect(process.env.REGISTRY_URL);

    this.registryConnection.on('error', (error: Error) => {
      this.logger.error('Error in RabbitMQ has been occurred', error);
      HawkCatcher.send(error, {
        workerType: this.type,
      });

      /**
       * Exit process on RabbitMQ connection error to restart worker
       */
      process.exit(1);
    });

    this.channelWorkers.forEach((worker) => worker.useRegistryConnection(this.registryConnection));
  }

  /**
   * Parse SENDER_CHANNELS env variable. All known channels are enabled when it is not set
   */
  private getEnabledChannels(): ChannelType[] {
    const knownChannels = Object.keys(channelProviders) as ChannelType[];

    if (!process.env.SENDER_CHANNELS) {
      return knownChannels;
    }

    const channels = process.env.SENDER_CHANNELS
      .split(',')
      .map((channel) => channel.trim())
      .filter(Boolean) as ChannelType[];

    const unknownChannels = channels.filter((channel) => !knownChannels.includes(channel));

    if (unknownChannels.length > 0) {
      throw Error(`Unknown channels in SENDER_CHANNELS: ${unknownChannels.join(', ')}. Available: ${knownChannels.join(', ')}`);
    }

    if (channels.length === 0) {
      throw Error('SENDER_CHANNELS is set but contains no channels');
    }

    return channels;
  }
}
