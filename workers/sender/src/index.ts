import { DecodedGroupedEvent, ProjectDBScheme } from 'hawk.types';
import { ObjectId } from 'mongodb';
import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import './env';

import { EventsTemplateVariables, TemplateEventData } from '../types/template-variables';
import NotificationsProvider from './provider';
import { ChannelType } from 'hawk-worker-notifier/types/channel';
import { SenderWorkerTask } from 'hawk-worker-notifier/types/sender-task';
import { decodeUnsafeFields } from '../../../lib/utils/unsafeFields';

/**
 * Worker to send email notifications
 */
export default abstract class SenderWorker extends Worker {
  /**
   * Worker type
   */
  public readonly type: string = pkg.workerType;

  /**
   * Database Controllers
   */
  private eventsDb: DatabaseController = new DatabaseController(process.env.MONGO_EVENTS_DATABASE_URI);
  private accountsDb: DatabaseController = new DatabaseController(process.env.MONGO_ACCOUNTS_DATABASE_URI);

  /**
   * Notifications provider
   */
  protected abstract provider: NotificationsProvider;

  /**
   * Sender type. Used to get correct notifications endpoint from DB
   */
  protected abstract channelType: ChannelType;

  /**
   * Constructor uses to check required ENV params
   */
  constructor() {
    super();

    if (!process.env.GARAGE_URL) {
      throw Error('procces.env.GARAGE_URL does not specified. Check workers/sender/.env');
    }

    if (!process.env.API_STATIC_URL) {
      throw Error('procces.env.API_STATIC_URL does not specified. Check workers/sender/.env');
    }
  }

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.eventsDb.connect();
    await this.accountsDb.connect();
    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    await super.finish();
    await this.eventsDb.close();
    await this.accountsDb.close();
  }

  /**
   * Task handling function
   *
   * @param task - task to handle
   */
  public async handle({ projectId, ruleId, events }: SenderWorkerTask): Promise<void> {
    if (!this.channelType) {
      throw new Error('channelType for Sender worker is not set');
    }

    if (!this.provider || typeof this.provider.send !== 'function') {
      throw new Error('Notification Provider is not set or doesn\'t have `send` method');
    }

    if (!this.provider.logger) {
      this.provider.setLogger(this.logger);
    }

    const project = await this.getProject(projectId);

    if (!project) {
      return;
    }

    const rule = project.notifications.find((r) => r._id.toString() === ruleId);

    if (!rule) {
      return;
    }

    const channel = rule.channels[this.channelType];

    if (!channel || !channel.endpoint) {
      return;
    }

    const eventsData = await Promise.all(
      events.map(
        async ({ key: groupHash, count }: {key: string; count: number}): Promise<TemplateEventData> => {
          const [event, daysRepeated] = await this.getEventDataByGroupHash(projectId, groupHash);

          return {
            event,
            newCount: count,
            daysRepeated,
          };
        }
      )
    );

    this.provider.send(channel.endpoint, {
      host: process.env.GARAGE_URL,
      hostOfStatic: process.env.API_STATIC_URL,
      project,
      events: eventsData,
      period: channel.minPeriod,
    } as EventsTemplateVariables);
  }

  /**
   * Get event data for email
   *
   * @param {string} projectId - project events are related to
   * @param {string} groupHash - event group hash
   *
   * @returns {Promise<[GroupedEventDBScheme, number]>}
   */
  private async getEventDataByGroupHash(
    projectId: string,
    groupHash: string
  ): Promise<[DecodedGroupedEvent, number]> {
    const connection = await this.eventsDb.getConnection();

    const event = await connection.collection(`events:${projectId}`).findOne({ groupHash });

    decodeUnsafeFields(event);

    const daysRepeated = await connection.collection(`dailyEvents:${projectId}`).countDocuments({
      groupHash,
    });

    return [event, daysRepeated];
  }

  /**
   * Get project info
   *
   * @param {string} projectId - project id
   * @returns {Promise<ProjectDBScheme>}
   */
  private async getProject(projectId: string): Promise<ProjectDBScheme | null> {
    const connection = await this.accountsDb.getConnection();

    return connection.collection('projects').findOne({ _id: new ObjectId(projectId) });
  }
}
