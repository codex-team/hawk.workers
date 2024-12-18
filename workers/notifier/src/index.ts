'use strict';

import { ObjectID } from 'mongodb';
import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as pkg from '../package.json';
import { Channel, ChannelKey, SenderData } from '../types/channel';
import { NotifierEvent, NotifierWorkerTask } from '../types/notifier-task';
import { Rule } from '../types/rule';
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
  private eventsDb: DatabaseController = new DatabaseController(process.env.MONGO_EVENTS_DATABASE_URI);

  /**
   * Redis helper instance for modifying data through redis
   */
  private redis = new RedisHelper();

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    await this.accountsDb.connect();
    await this.eventsDb.connect();
    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    await super.finish();
    await this.accountsDb.connect();
    await this.eventsDb.connect();
  }

  /**
   * Task handling function
   * Checks if event count is equal to the threshold and sends event to channels if it is
   * Otherwise, increments the event count
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
         * If rule is enabled no need to store data in redis
         */
        if (rule.isEnabled === false) {
          return;
        }

<<<<<<< Updated upstream
        rules.forEach((rule) => {
          this.addEventToChannels(projectId, rule, event);
        });
      }
=======
        const currentEventCount = await this.redis.getCurrentEventCount(rule._id.toString(), event.groupHash, rule.eventThresholdPeriod);

        /**
         * If threshold reached, then send event to channels
         */
        if (rule.threshold === currentEventCount) {
          await this.addEventToChannels(projectId, rule, event);
        }
      }      
>>>>>>> Stashed changes
    } catch (e) {
      this.logger.error('Failed to handle message because of ', e);
    }
  }

  /**
<<<<<<< Updated upstream
   * Method that returns threshold for current project
   * Used to check if event is critical or not
   *
   * @param projectId - if of the project, to get notification threshold for
   */
  private async getNotificationThreshold(projectId: string): Promise<number> {
    const storedEventsCount = this.redis.getProjectNotificationThreshold(projectId);

    /**
     * If redis has no threshold stored, then get it from the database
     */
    if (storedEventsCount === null) {
      const connection = this.eventsDb.getConnection();

      const currentTime = Date.now();
      /* eslint-disable-next-line @typescript-eslint/no-magic-numbers */
      const twoDaysAgo = currentTime - 48 * 60 * 60 * 1000;
      /* eslint-disable-next-line @typescript-eslint/no-magic-numbers */
      const oneDayAgo = currentTime - 24 * 60 * 60 * 1000;

      const events = connection.collection(`events:${projectId}`);
      const repetitions = connection.collection(`repetitions:${projectId}`);

      /**
       * Get ten events of the current project
       */
      /* eslint-disable-next-line @typescript-eslint/no-magic-numbers */
      const eventsToEvaluate = await events.find({}).limit(10)
        .toArray();

      let averageProjectRepetitionsADay = 0;

      /**
       * For each event get repetitions since two days to one day ago
       */
      eventsToEvaluate.forEach(async (event) => {
        const repetitionsCount = await repetitions.countDocuments({
          'payload.timestamp': {
            $gte: twoDaysAgo,
            $le: oneDayAgo,
          },
          groupHash: event.groupHash,
        });

        averageProjectRepetitionsADay += repetitionsCount;
      });

      /**
       * Set counted repetitions count into redis storage
       */
      this.redis.setProjectNotificationTreshold(projectId, averageProjectRepetitionsADay);

      /**
       * Return floored average repetitions count
       */
      /* eslint-disable-next-line @typescript-eslint/no-magic-numbers */
      return Math.floor(averageProjectRepetitionsADay / 10);
    }
  }

  /**
   * Check if event is critical
   *
   * @param projectId - id of the project to of the event
   * @param {NotifierEvent} event — received event
   * @returns {boolean}
   */
  private async isEventCritical(projectId: string, event: NotifierEvent): Promise<boolean> {
    /**
     * Get current event repetitions from digest
     */
    const eventRepetitionsToday = await this.redis.getEventRepetitionsFromDigest(projectId, event.groupHash);

    const projectThreshold = await this.getNotificationThreshold(projectId);

    /**
     * Check if event repetitions are equal to threshold
     */
    if (eventRepetitionsToday !== null && eventRepetitionsToday === projectThreshold) {
      return true;
    /**
     * Check if event is new
     */
    } else if (event.isNew) {
      return true;
    }

    /**
     * Event is not critical in other cases
     */
    return false;
  }

  /**
=======
>>>>>>> Stashed changes
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
   * Add event to channel's buffer or set timer if it doesn't exist
   *
   * @param {string} projectId - project id event is related to
   * @param {Rule} rule - notification rule
   * @param {NotifierEvent} event - received event
   */
  private async addEventToChannels(projectId: string, rule: Rule, event: NotifierEvent): Promise<void> {
    const channels: Array<[string, Channel]> = Object.entries(rule.channels as { [name: string]: Channel });

    for (const [name, options] of channels) {
      /**
       * If channel is disabled by user, do not add event to it
       */
      if (!options.isEnabled) {
        return;
      }
      
      const channelKey: ChannelKey = [projectId, rule._id.toString(), name];
      
      await this.sendToSenderWorker(channelKey, [ {
        key: event.groupHash,
        count: 1,
      }]);
    };
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
