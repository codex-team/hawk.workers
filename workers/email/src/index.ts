import {GroupedEvent} from 'hawk-worker-grouper/types/grouped-event';
import {ObjectID} from 'mongodb';
import {DatabaseController} from '../../../lib/db/controller';
import {Worker} from '../../../lib/worker';
import * as pkg from '../package.json';
import {EmailSenderWorkerTask} from '../types/task';
import EmailProvider from './provider';
import Templates from './templates/names';

import dotenv from 'dotenv';
import path from 'path';
import {Project} from '../types/project';
import {NewEventTemplateVariables} from "../types/template-variables";

/**
 * Load local environment configuration
 */
const localEnv = dotenv.config({path: path.resolve(__dirname, '../.env')}).parsed;

Object.assign(process.env, localEnv);

export default class EmailSenderWorker extends Worker {
  /**
   * Worker type
   */
  public readonly type: string = pkg.workerType;

  /**
   * Database Controllers
   */
  private eventsDb: DatabaseController = new DatabaseController();
  private accountsDb: DatabaseController = new DatabaseController();

  /**
   * Email provider
   */
  private emailProvider = new EmailProvider();

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.eventsDb.connect(process.env.EVENTS_DB_NAME);
    await this.accountsDb.connect(process.env.ACCOUNTS_DB_NAME);
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
   * @param {EmailSenderWorkerTask} task - task to handle
   */
  public async handle({projectId, endpoint, events}: EmailSenderWorkerTask): Promise<void> {
    for (const {key: groupHash, count} of events) {
      const [event, daysRepeated] = await this.getEventDataByGroupHash(projectId, groupHash);
      const project = await this.getProject(projectId);

      if (!event || !project) {
        continue;
      }

      await this.emailProvider.send(endpoint, Templates.NewEvent, {
        host: process.env.GARAGE_URL,
        project,
        event,
        daysRepeated,
        usersAffected: 10,
      } as NewEventTemplateVariables);
    }
  }

  /**
   * Get event data for email
   *
   * @param {string} projectId - project events are related to
   * @param {string} groupHash - event group hash
   *
   * @return {Promise<[GroupedEvent, number]>}
   */
  private async getEventDataByGroupHash(
    projectId: string,
    groupHash: string,
  ): Promise<[GroupedEvent, number]> {
    const connection = await this.eventsDb.getConnection();

    const event = await connection.collection(`events:${projectId}`).findOne({groupHash});
    const daysRepeated = await connection.collection(`dailyEvents:${projectId}`).countDocuments({
      groupHash,
    });

    return [event, daysRepeated];
  }

  /**
   * Get project info
   *
   * @param {string} projectId - project id
   * @return {Promise<Project>}
   */
  private async getProject(projectId: string): Promise<Project> {
    const connection = await this.accountsDb.getConnection();

    return connection.collection('projects').findOne({_id: new ObjectID(projectId)});
  }
}
