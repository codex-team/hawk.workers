'use strict';

import { ObjectID } from 'mongodb';
import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import { Channel, ChannelKey, SenderData } from '../types/channel';
import { NotifierEvent, NotifierWorkerTask } from '../types/notifier-task';
import { Rule, WhatToReceive } from '../types/rule';
import { SenderWorkerTask } from 'hawk-worker-sender/types/sender-task';
import RuleValidator from './validator';
import Time from '../../../lib/utils/time';
import RedisHelper from './redisHelper';

/**
 * Worker to buffer events before sending notifications about them
 */
export default class NotifierWorker extends Worker {
  /**
   * Worker type
   */
  public readonly type: string = pkg.workerType;

  /**
   * Database Controllers
   */
  private accountsDb: DatabaseController = new DatabaseController(process.env.MONGO_ACCOUNTS_DATABASE_URI);

  /**
   * Redis helper instance for modifying data through redis
   */
  private redis = new RedisHelper();

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.accountsDb.connect();
    await this.redis.initialize();
    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    await super.finish();
    await this.accountsDb.close();
    await this.redis.close();
  }

  /**
   * Task handling function
   * Checks if event count is equal to the threshold and sends event to channels if it is
   * Otherwise, increments the event count
   *
   * @param task — notifier task to handle
   */
  public async handle(task: NotifierWorkerTask): Promise<void> {
    try {
      const { projectId, event } = task;

      /**
       * Get fitter rules for received event
       */
      const rules = await this.getFittedRules(projectId, event);

      for (const rule of rules) {
        /**
         * If rule is disabled no need to store data in redis
         */
        if (rule.isEnabled === false) {
          return;
        }

        /**
         * If validation for rule with whatToReceive.New passed, then event is new and we can send it to channels
         */
        if (rule.whatToReceive === WhatToReceive.New) {
          await this.sendEventsToChannels(projectId, rule, event);

          return;
        }

        const currentEventCount = await this.redis.computeEventCountForPeriod(projectId, rule._id.toString(), event.groupHash, rule.thresholdPeriod);

        /**
         * If threshold reached, then send event to channels
         */
        if (rule.threshold === currentEventCount) {
          await this.sendEventsToChannels(projectId, rule, event);
        }
      }
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
      rules = await this.cache.get(
        `projectNotificationRules:${projectId}`,
        () => {
          return this.getProjectNotificationRules(projectId);
        },
        Time.MINUTE
      );
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
   * Send event to sender worker for each channel key
   *
   * @param {string} projectId - project id event is related to
   * @param {Rule} rule - notification rule
   * @param {NotifierEvent} event - received event
   */
  private async sendEventsToChannels(projectId: string, rule: Rule, event: NotifierEvent): Promise<void> {
    const channels: Array<[string, Channel]> = Object.entries(rule.channels as { [name: string]: Channel });

    for (const [name, options] of channels) {
      /**
       * If channel is disabled by user, do not add event to it
       */
      if (!options.isEnabled) {
        continue;
      }

      const channelKey: ChannelKey = [projectId, rule._id.toString(), name];

      await this.sendToSenderWorker(channelKey, [ {
        key: event.groupHash,
        count: 1,
      } ]);
    }
  }

  /**
   * Send task to sender workers
   *
   * @param {ChannelKey} key — buffer key
   * @param {SenderData[]} events - events to send
   */
  private async sendToSenderWorker(key: ChannelKey, events: SenderData[]): Promise<void> {
    const [projectId, ruleId, channelName] = key;

    await this.addTask(`sender/${channelName}`, {
      type: 'event',
      payload: {
        projectId,
        ruleId,
        events,
      },
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
    const connection = this.accountsDb.getConnection();
    const projects = connection.collection('projects');

    const project = await projects.findOne({ _id: new ObjectID(projectId) });

    if (!project) {
      throw new Error('There is no project with given id');
    }

    return project.notifications || [];
  }
}
