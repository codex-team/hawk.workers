import { DecodedGroupedEvent, ProjectDBScheme, UserDBScheme, GroupedEventDBScheme } from 'hawk.types';
import { ObjectId } from 'mongodb';
import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import './env';

import { TemplateEventData } from '../types/template-variables/';
import NotificationsProvider from './provider';

import { ChannelType } from 'hawk-worker-notifier/types/channel';
import { SenderWorkerEventTask, SenderWorkerAssigneeTask, SenderWorkerTask } from '../types/sender-task';
import { decodeUnsafeFields } from '../../../lib/utils/unsafeFields';
import { Notification } from './../types/template-variables';

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
  public async handle<T extends SenderWorkerTask>(task: T): Promise<void> {
    if (!this.channelType) {
      throw new Error('channelType for Sender worker is not set');
    }

    if (!this.provider || typeof this.provider.send !== 'function') {
      throw new Error('Notification Provider is not set or doesn\'t have `send` method');
    }

    if (!this.provider.logger) {
      this.provider.setLogger(this.logger);
    }

    switch (task.type) {
      case 'event': return this.handleEventTask(task as SenderWorkerEventTask);
      case 'assignee': return this.handleAssigneeTask(task as SenderWorkerAssigneeTask);
    }
  }

  /**
   * Handle event task
   *
   * @param task - task to handke
   */
  private async handleEventTask(task: SenderWorkerEventTask): Promise<void> {
    const { projectId, ruleId, events } = task.payload;

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
        async ({ key: groupHash, count }: { key: string; count: number }): Promise<TemplateEventData> => {
          const [event, daysRepeated] = await this.getEventDataByGroupHash(projectId, groupHash);

          return {
            event,
            newCount: count,
            daysRepeated,
          };
        }
      )
    );

    let notificationType: Notification['type'] = 'event';

    if (eventsData.length > 1) {
      notificationType = 'several-events';
    }

    this.provider.send(channel.endpoint, {
      type: notificationType,
      payload: {
        host: process.env.GARAGE_URL,
        hostOfStatic: process.env.API_STATIC_URL,
        project,
        events: eventsData,
        period: channel.minPeriod,
      },
    });
  }

  /**
   * Handle task when someone was assigned
   *
   * @param task - task to handle
   */
  private async handleAssigneeTask(task: SenderWorkerAssigneeTask): Promise<void> {
    const { assigneeId, projectId, whoAssignedId, eventId, endpoint } = task.payload;

    const project = await this.getProject(projectId);

    if (!project) {
      console.log('Project not found');

      return;
    }

    const [event, daysRepeated] = await this.getEventData(projectId, eventId);

    if (!event) {
      console.log('Event not found');

      return;
    }

    const whoAssigned = await this.getUser(whoAssignedId);

    if (!whoAssigned) {
      console.log('User who assigned the person was not found');

      return;
    }

    const assignee = await this.getUser(assigneeId);

    if (!assignee) {
      console.log('Assignee not found');

      return;
    }

    this.provider.send(endpoint, {
      type: 'assignee',
      payload: {
        host: process.env.GARAGE_URL,
        hostOfStatic: process.env.API_STATIC_URL,
        project,
        event,
        whoAssigned,
        daysRepeated,
      },
    });
  }

  /**
   * Get event data for email
   *
   * @param {string} projectId - project events are related to
   * @param {string} groupHash - event group hash
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
   * Get event data by projectId and eventId
   *
   * @param projectId - project id of the event
   * @param eventId - id of the event
   */
  private async getEventData(projectId: string, eventId: string): Promise<[GroupedEventDBScheme, number]> {
    const connection = await this.eventsDb.getConnection();

    const event = await connection.collection(`events:${projectId}`).findOne({
      _id: new ObjectId(eventId),
    });
    const daysRepeated = await connection.collection(`dailyEvents:${projectId}`).countDocuments({
      groupHash: event.groupHash,
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

  /**
   * Get user data
   *
   * @param userId - user id
   */
  private async getUser(userId: string): Promise<UserDBScheme | null> {
    const connection = await this.accountsDb.getConnection();

    return connection.collection('users').findOne({ _id: new ObjectId(userId) });
  }
}
