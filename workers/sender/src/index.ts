import {
  DecodedGroupedEvent,
  ProjectDBScheme,
  UserDBScheme,
  GroupedEventDBScheme,
  WorkspaceDBScheme,
  ConfirmedMemberDBScheme
} from 'hawk.types';
import { ObjectId } from 'mongodb';
import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import './env';

import { TemplateEventData } from '../types/template-variables/';
import NotificationsProvider from './provider';

import { ChannelType } from 'hawk-worker-notifier/types/channel';
import {
  SenderWorkerEventTask,
  SenderWorkerAssigneeTask,
  SenderWorkerTask,
  SenderWorkerBlockWorkspaceTask
} from '../types/sender-task';
import { decodeUnsafeFields } from '../../../lib/utils/unsafeFields';
import { Notification, EventNotification, SeveralEventsNotification, AssigneeNotification } from '../types/template-variables';

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
      case 'block-workspace': return this.handleBlockWorkspaceTask(task as SenderWorkerBlockWorkspaceTask);
    }
  }

  /**
   * Handle event task
   *
   * @param task - task to handle
   */
  private async handleEventTask(task: SenderWorkerEventTask): Promise<void> {
    const { projectId, ruleId, events } = task.payload;

    const project = await this.getProject(projectId);

    if (!project) {
      this.logger.error(`Cannot send assignee notification: project not found. Payload: ${task}`);

      return;
    }

    const rule = project.notifications.find((r) => r._id.toString() === ruleId);

    if (!rule) {
      this.logger.error(`Cannot send assignee notification: notification rule not found. Payload: ${task}`);

      return;
    }

    const channel = rule.channels[this.channelType];

    if (!channel || !channel.endpoint) {
      this.logger.error(`Cannot send assignee notification: channel not found. Payload: ${task}`);

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
    } as EventNotification | SeveralEventsNotification);
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
      this.logger.error(`Cannot send assignee notification: project not found. Payload: ${task}`);

      return;
    }

    const [event, daysRepeated] = await this.getEventData(projectId, eventId);

    if (!event) {
      this.logger.error(`Cannot send assignee notification: event not found. Payload: ${task}`);

      return;
    }

    const whoAssigned = await this.getUser(whoAssignedId);

    if (!whoAssigned) {
      this.logger.error(`Cannot send assignee notification: user who assigned the person was not found. Payload: ${task}`);

      return;
    }

    const assignee = await this.getUser(assigneeId);

    if (!assignee) {
      this.logger.error(`Cannot send assignee notification: assignee not found. Payload: ${task}`);

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
    } as AssigneeNotification);
  }

  /**
   * Handle task when workspace blocked
   *
   * @param task - task to handle
   */
  private async handleBlockWorkspaceTask(task: SenderWorkerBlockWorkspaceTask): Promise<void> {
    const { workspaceId } = task.payload;

    const workspace = await this.getWorkspace(workspaceId);

    if (!workspace) {
      this.logger.error(`Cannot send block workspace notification: workspace not found. Payload: ${task}`);

      return;
    }

    const admins = await this.getWorkspaceAdmins(workspaceId);

    if (!admins) {
      this.logger.error(`Cannot send block workspace notification: workspace team not found. Payload: ${task}`);

      return;
    }

    const adminIds = admins.map(admin => admin.userId.toString());
    const users = await this.getUsers(adminIds);

    await Promise.all(users.map(async user => {
      const channel = user.notifications.channels[this.channelType];

      if (channel.isEnabled) {
        await this.provider.send(channel.endpoint, {
          type: 'block-workspace',
          payload: {
            host: process.env.GARAGE_URL,
            hostOfStatic: process.env.API_STATIC_URL,
            workspace,
          },
        });
      }
    }));
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
   * Gets workspace info from database
   *
   * @param workspaceId - workspace id for search
   */
  private async getWorkspace(workspaceId: string): Promise<WorkspaceDBScheme | null> {
    const connection = await this.accountsDb.getConnection();

    return connection.collection('workspaces').findOne({ _id: new ObjectId(workspaceId) });
  }

  /**
   * Gets confirmed admins by workspace id
   *
   * @param workspaceId - workspace id for search
   */
  private async getWorkspaceAdmins(workspaceId: string): Promise<ConfirmedMemberDBScheme[] | null> {
    const connection = await this.accountsDb.getConnection();

    return connection.collection(`team:${workspaceId}`).find({
      userId: { $exists: true },
      isAdmin: true,
    })
      .toArray();
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

  /**
   * Gets array of users from database
   *
   * @param userIds - user ids for search
   */
  private async getUsers(userIds: string[]): Promise<UserDBScheme[] | null> {
    const connection = await this.accountsDb.getConnection();

    return connection.collection('users').find({ _id: userIds.map(userId => new ObjectId(userId)) })
      .toArray();
  }
}
