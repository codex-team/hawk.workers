'use strict';

import { ObjectID } from 'mongodb';
import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import { Channel } from '../types/channel';
import { NotifierEvent, NotifierWorkerTask } from '../types/notifier-task';
import { Rule } from '../types/rule';
import { SenderWorkerTask } from '../types/sender-task';
import Buffer, { BufferData, ChannelKey, EventKey } from './buffer';
import RuleValidator from './validator';

/**
 * Worker to buffer events before sending notifications about them
 */
export default class NotifierWorker extends Worker {
  /**
   * Worker type
   */
  public readonly type: string = pkg.workerType;

  /**
   * Database Controller
   */
  private db: DatabaseController = new DatabaseController(process.env.MONGO_ACCOUNTS_DATABASE_URI);

  /**
   * Received events buffer
   */
  private buffer: Buffer = new Buffer();

  /**
   * Default period between messages in seconds
   */
  private DEFAULT_MIN_PERIOD = 60

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.db.connect();
    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    await super.finish();
    await this.db.close();
  }

  /**
   * Task handling function
   *
   * Handling scheme:
   *
   * 1) On task received
   *   -> receive task
   *   -> get project notification rules
   *   -> filter rules
   *   -> check channel timer
   *      a) if timer doesn't exist
   *        -> send tasks to sender workers
   *        -> set timeout for minPeriod
   *      b) if timer exists
   *        -> push event to channel's buffer
   *
   * 2) On timeout
   *   -> get events from channel's buffer
   *   -> flush channel's buffer
   *   -> send tasks to sender workers
   *
   * @param {NotifierWorkerTask} task — task to handle
   */
  public async handle(task: NotifierWorkerTask): Promise<void> {
    try {
      const { projectId, event } = task;

      const rules = await this.getFittedRules(projectId, event);

      rules.forEach((rule) => {
        this.addEventToChannels(projectId, rule, event);
      });
    } catch (e) {
      this.logger.error('Failed to handle message because of ', e);
    }
  }

  /**
   * Get project notifications rules that matches received event
   *
   * @param {string} projectId — project id event is related to
   * @param {NotifierEvent} event — received event
   * @returns {Promise<Rule[]>}
   */
  private async getFittedRules(projectId: string, event: NotifierEvent): Promise<Rule[]> {
    let rules: Rule[] = [];

    try {
      rules = await this.getProjectNotificationRules(projectId);
    } catch (e) {
      this.logger.warn('Failed to get project notification rules because ', e);
    }

    return rules
      .filter((rule) => {
        try {
          new RuleValidator(rule, event).checkAll();
        } catch (e) {
          return false;
        }

        return true;
      });
  }

  /**
   * Add event to channel's buffer or set timer if it doesn't exist
   *
   * @param {string} projectId - project id event is related to
   * @param {Rule} rule - notification rule
   * @param {NotifierEvent} event - received event
   */
  private addEventToChannels(projectId: string, rule: Rule, event: NotifierEvent): void {
    const channels: Array<[string, Channel]> = Object.entries(rule.channels as {[name: string]: Channel});

    channels.forEach(async ([name, options]) => {
      /**
       * If channel is disabled by user, do not add event to it
       */
      if (!options.isEnabled) {
        return;
      }

      const channelKey: ChannelKey = [projectId, rule._id.toString(), name];
      const eventKey: EventKey = [projectId, rule._id.toString(), name, event.groupHash];

      if (this.buffer.getTimer(channelKey)) {
        this.buffer.push(eventKey);

        return;
      }

      const minPeriod = (options.minPeriod || this.DEFAULT_MIN_PERIOD) * 1000;

      /**
       * Set timer to send events after min period of time is passed
       */
      this.buffer.setTimer(channelKey, minPeriod, this.sendEvents);

      await this.sendToSenderWorker(channelKey, [ {
        key: event.groupHash,
        count: 1,
      } ]);
    });
  }

  /**
   * Get events from buffer, flush buffer and send event to sender workers
   *
   * @param {ChannelKey} channelKey — buffer key
   */
  private sendEvents = async (channelKey: ChannelKey): Promise<void> => {
    this.buffer.clearTimer(channelKey);

    const events = this.buffer.flush(channelKey);

    if (!events.length) {
      return;
    }

    await this.sendToSenderWorker(channelKey, events);
  }

  /**
   * Send task to sender workers
   *
   * @param {ChannelKey} key — buffer key
   * @param {BufferData[]} events - events to send
   */
  private async sendToSenderWorker(key: ChannelKey, events: BufferData[]): Promise<void> {
    const [projectId, ruleId, channelName] = key;

    await this.addTask(`sender/${channelName}`, {
      projectId,
      ruleId,
      events,
    } as SenderWorkerTask);
  }

  /**
   * Get project notification rules
   *
   * @param {string} projectId - project id event is related to
   *
   * @returns {Promise<Rule[]>} - project notification rules
   */
  private async getProjectNotificationRules(projectId: string): Promise<Rule[]> {
    const connection = this.db.getConnection();
    const projects = connection.collection('projects');

    const project = await projects.findOne({ _id: new ObjectID(projectId) });

    if (!project) {
      throw new Error('There is no project with given id');
    }

    return project.notifications || [];
  }
}
