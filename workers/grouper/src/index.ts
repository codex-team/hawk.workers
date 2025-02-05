import './env';
import * as crypto from 'crypto';
import * as mongodb from 'mongodb';
import { DatabaseController } from '../../../lib/db/controller';
import * as utils from '../../../lib/utils';
import { Worker } from '../../../lib/worker';
import * as WorkerNames from '../../../lib/workerNames';
import * as pkg from '../package.json';
import { GroupWorkerTask } from '../types/group-worker-task';
import { EventAddons, EventDataAccepted, GroupedEventDBScheme, RepetitionDBScheme } from '@hawk.so/types';
import { DatabaseReadWriteError, DiffCalculationError, ValidationError } from '../../../lib/workerErrors';
import { decodeUnsafeFields, encodeUnsafeFields } from '../../../lib/utils/unsafeFields';
import HawkCatcher from '@hawk.so/nodejs';
import { MS_IN_SEC } from '../../../lib/utils/consts';
import DataFilter from './data-filter';
import RedisHelper from './redisHelper';
import levenshtein from 'js-levenshtein';
import TimeMs from '../../../lib/utils/time';

/**
 * Error code of MongoDB key duplication error
 */
const DB_DUPLICATE_KEY_ERROR = '11000';

/**
 * Worker for handling Javascript events
 */
export default class GrouperWorker extends Worker {
  /**
   * Worker type
   */
  public readonly type: string = pkg.workerType;

  /**
   * Database Controller
   */
  private db: DatabaseController = new DatabaseController(process.env.MONGO_EVENTS_DATABASE_URI);

  /**
   * This class will filter sensitive information
   */
  private dataFilter = new DataFilter();

  /**
   * Redis helper instance for modifying data through redis
   */
  private redis = new RedisHelper();

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    console.log('starting grouper worker');

    await this.db.connect();
    this.prepareCache();
    console.log('redis initializing');

    await this.redis.initialize();
    console.log('redis initialized');
    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    await super.finish();
    this.prepareCache();
    await this.db.close();
    await this.redis.close();
  }

  /**
   * Task handling function
   *
   * @param task - event to handle
   */
  public async handle(task: GroupWorkerTask): Promise<void> {
    let uniqueEventHash = await this.getUniqueEventHash(task);

    /**
     * Find event by group hash.
     */
    let existedEvent = await this.getEvent(task.projectId, {
      groupHash: uniqueEventHash,
    });

    /**
     * If we couldn't group by group hash (title), try grouping by Levenshtein distance with last N events
     */
    if (!existedEvent) {
      const similarEvent = await this.findSimilarEvent(task.projectId, task.event);

      if (similarEvent) {
        /**
         * Override group hash with found event's group hash
         */
        uniqueEventHash = similarEvent.groupHash;

        existedEvent = similarEvent;
      }
    }

    /**
     * Event happened for the first time
     */
    const isFirstOccurrence = existedEvent === null;

    let repetitionId = null;

    let incrementDailyAffectedUsers = false;

    /**
     * Filter sensitive information
     */
    this.dataFilter.processEvent(task.event);

    if (isFirstOccurrence) {
      try {
        const incrementAffectedUsers = task.event.user ? true : false;

        /**
         * Insert new event
         */
        await this.saveEvent(task.projectId, {
          groupHash: uniqueEventHash,
          totalCount: 1,
          catcherType: task.catcherType,
          payload: task.event,
          usersAffected: incrementAffectedUsers ? 1 : 0,
        } as GroupedEventDBScheme);

        /**
         * Increment daily affected users for the first event
         */
        incrementDailyAffectedUsers = incrementAffectedUsers;
      } catch (e) {
        /**
         * If we caught Database duplication error, then another worker thread has already saved it to the database
         * and we need to process this event as repetition
         */
        if (e.code?.toString() === DB_DUPLICATE_KEY_ERROR) {
          console.log('DB_DUPLICATE_KEY_ERROR');
          
          HawkCatcher.send(new Error('[Grouper] MongoError: E11000 duplicate key error collection'));
          await this.handle(task);

          return;
        } else {
          throw e;
        }
      }
    } else {
      const [incrementAffectedUsers, shouldIncrementDailyAffectedUsers] = await this.shouldIncrementAffectedUsers(task, existedEvent);

      incrementDailyAffectedUsers = shouldIncrementDailyAffectedUsers;

      /**
       * Increment existed task's counter
       */
      await this.incrementEventCounterAndAffectedUsers(task.projectId, {
        groupHash: uniqueEventHash,
      }, incrementAffectedUsers);

      /**
       * Decode existed event to calculate diffs correctly
       */
      decodeUnsafeFields(existedEvent);

      let diff;

      try {
        /**
         * Save event's repetitions
         */
        diff = utils.deepDiff(existedEvent.payload, task.event);
      } catch (e) {
        throw new DiffCalculationError(e, existedEvent.payload, task.event);
      }

      const newRepetition = {
        groupHash: uniqueEventHash,
        payload: diff,
      } as RepetitionDBScheme;

      repetitionId = await this.saveRepetition(task.projectId, newRepetition);
    }

    /**
     * Store events counter by days
     */
    await this.saveDailyEvents(task.projectId, uniqueEventHash, task.event.timestamp, repetitionId, incrementDailyAffectedUsers);

    /**
     * Add task for NotifierWorker
     */
    if (process.env.IS_NOTIFIER_WORKER_ENABLED) {
      await this.addTask(WorkerNames.NOTIFIER, {
        projectId: task.projectId,
        event: {
          title: task.event.title,
          groupHash: uniqueEventHash,
          isNew: isFirstOccurrence,
        },
      });
    }
  }

  /**
   * Get unique hash based on event type and title
   *
   * @param task - worker task to create hash
   */
  private getUniqueEventHash(task: GroupWorkerTask): Promise<string> {
    return this.cache.get(`groupHash:${task.projectId}:${task.catcherType}:${task.event.title}`, () => {
      return crypto.createHmac('sha256', process.env.EVENT_SECRET)
        .update(task.catcherType + task.event.title)
        .digest('hex');
    });
  }

  /**
   * Tries to find events with a small Levenshtein distance of a title
   *
   * @param projectId - where to find
   * @param event - event to compare
   */
  private async findSimilarEvent(projectId: string, event: EventDataAccepted<EventAddons>): Promise<GroupedEventDBScheme | undefined> {
    const eventsCountToCompare = 60;
    const diffTreshold = 0.35;

    const lastUniqueEvents = await this.findLastEvents(projectId, eventsCountToCompare);

    return lastUniqueEvents.filter(prevEvent => {
      const distance = levenshtein(event.title, prevEvent.payload.title);
      const threshold = event.title.length * diffTreshold;

      return distance < threshold;
    }).pop();
  }

  /**
   * Returns last N unique events by a project id
   *
   * @param projectId - where to find
   * @param count - how many events to return
   */
  private findLastEvents(projectId: string, count): Promise<GroupedEventDBScheme[]> {
    return this.cache.get(`last:${count}:eventsOf:${projectId}`, async () => {
      return this.db.getConnection()
        .collection(`events:${projectId}`)
        .find()
        .sort({
          _id: 1,
        })
        .limit(count)
        .toArray();
    },  
    /**
     * TimeMs class stores time intervals in milliseconds, however NodeCache ttl needs to be specified in seconds
     */
    /* eslint-disable-next-line @typescript-eslint/no-magic-numbers */
    TimeMs.MINUTE / 1000);
  }

  /**
   * Decides whether to increase the number of affected users for the repetition and the daily aggregation
   *
   * @param task - worker task to process
   * @param existedEvent - original event to get its user
   * @returns {[boolean, boolean]} - whether to increment affected users for the repetition and the daily aggregation
   */
  private async shouldIncrementAffectedUsers(task: GroupWorkerTask, existedEvent: GroupedEventDBScheme): Promise<[boolean, boolean]> {
    const eventUser = task.event.user;

    /**
     * In case of no user, we don't need to increment affected users
     */
    if (!eventUser) {
      return [false, false];
    }


    /**
     * Default to true - we'll set to false if conditions are met
     */
    let shouldIncrementRepetitionAffectedUsers = true;
    let shouldIncrementDailyAffectedUsers = true;

    /**
     * Check if user is the same as original event
     */
    const isUserFromOriginalEvent = existedEvent.payload.user?.id === eventUser.id;

    /**
     * If user is the same as original event, don't increment repetition affected users
     */
    if (isUserFromOriginalEvent) {
      shouldIncrementRepetitionAffectedUsers = false;
    } else {
      /**
       * Check if repetition exists for the user, if so, don't increment affected users
       */
      const repetitionCacheKey = `repetitions:${task.projectId}:${existedEvent.groupHash}:${eventUser.id}`;
      const repetition = await this.cache.get(repetitionCacheKey, async () => {
        return this.db.getConnection().collection(`repetitions:${task.projectId}`)
          .findOne({
            groupHash: existedEvent.groupHash,
            'payload.user.id': eventUser.id,
          });
      });

      if (repetition) {
        shouldIncrementRepetitionAffectedUsers = false;
      }
    }

    /**
     * Get midnight timestamps for the event and the next day
     */
    const eventMidnight = this.getMidnightByEventTimestamp(task.event.timestamp);
    const eventNextMidnight = this.getMidnightByEventTimestamp(task.event.timestamp, true);

    /**
     * Check if incoming event has the same day as the original event
     */
    const isSameDay = existedEvent.payload.timestamp > eventMidnight && existedEvent.payload.timestamp < eventNextMidnight;

    /**
     * If incoming event has the same day as the original event and the same user, don't increment daily affected users
     */
    if (isSameDay && existedEvent.payload.user?.id === eventUser.id) {
      shouldIncrementDailyAffectedUsers = false;
    } else {
      /**
       * Check if daily repetition exists for the user, if so, don't increment affected users
       */
      const repetitionDailyCacheKey = `repetitions:${task.projectId}:${existedEvent.groupHash}:${eventUser.id}:${eventMidnight}`;
      const repetitionDaily = await this.cache.get(repetitionDailyCacheKey, async () => {
        return this.db.getConnection().collection(`repetitions:${task.projectId}`)
          .findOne({
            groupHash: existedEvent.groupHash,
            'payload.user.id': eventUser.id,
            'payload.timestamp': {
              $gte: eventMidnight,
              $lt: eventNextMidnight,
            },
          });
      });

      /**
       * If daily repetition exists, don't increment daily affected users
       */
      if (repetitionDaily) {
        shouldIncrementDailyAffectedUsers = false;
      }
    }

    /**
     * Check Redis lock - if locked, don't increment either counter
     */
    const isEventLocked = await this.redis.checkOrSetlockEventForAffectedUsersIncrement(existedEvent.groupHash, eventUser.id);
    const isDailyEventLocked = await this.redis.checkOrSetlockDailyEventForAffectedUsersIncrement(existedEvent.groupHash, eventUser.id, eventMidnight);

    shouldIncrementRepetitionAffectedUsers = isEventLocked ? false : shouldIncrementRepetitionAffectedUsers;
    shouldIncrementDailyAffectedUsers = isDailyEventLocked ? false : shouldIncrementDailyAffectedUsers;

    return [shouldIncrementRepetitionAffectedUsers, shouldIncrementDailyAffectedUsers];
  }

  /**
   * Returns finds event by query from project with passed ID
   *
   * @param projectId - project's identifier
   * @param query - mongo query string
   */
  private async getEvent(projectId: string, query: Record<string, unknown>): Promise<GroupedEventDBScheme> {
    if (!mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveEvent: Project ID is invalid or missed');
    }

    const eventCacheKey = `${projectId}:${JSON.stringify(query)}`;

    return this.cache.get(eventCacheKey, async () => {
      return this.db.getConnection()
        .collection(`events:${projectId}`)
        .findOne(query)
        .catch((err) => {
          throw new DatabaseReadWriteError(err);
        });
    });
  }

  /**
   * Save event to database
   *
   * @param projectId - project id
   * @param groupedEventData - event data
   * @throws {ValidationError} if `projectID` is not provided or invalid
   * @throws {ValidationError} if `eventData` is not a valid object
   */
  private async saveEvent(projectId: string, groupedEventData: GroupedEventDBScheme): Promise<mongodb.ObjectID> {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveEvent: Project ID is invalid or missed');
    }

    const collection = this.db.getConnection().collection(`events:${projectId}`);

    encodeUnsafeFields(groupedEventData);

    return (await collection
      .insertOne(groupedEventData)).insertedId as mongodb.ObjectID;
  }

  /**
   * Inserts unique event repetition to the database
   *
   * @param projectId - project's identifier
   * @param {RepetitionDBScheme} repetition - object that contains only difference with first event
   */
  private async saveRepetition(projectId: string, repetition: RepetitionDBScheme): Promise<mongodb.ObjectID> {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveRepetition: Project ID is invalid or missing');
    }

    try {
      const collection = this.db.getConnection().collection(`repetitions:${projectId}`);

      encodeUnsafeFields(repetition);

      return (await collection.insertOne(repetition)).insertedId as mongodb.ObjectID;
    } catch (err) {
      throw new DatabaseReadWriteError(err, {
        repetition: repetition as unknown as Record<string, never>,
        projectId,
      });
    }
  }

  /**
   * If event in project exists this method increments counter
   *
   * @param projectId - project id to increment
   * @param query - query to get event
   * @param incrementAffected - if true, usersAffected counter will be incremented
   */
  private async incrementEventCounterAndAffectedUsers(projectId, query, incrementAffected: boolean): Promise<number> {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveEvent: Project ID is invalid or missed');
    }

    try {
      const updateQuery = incrementAffected
        ? {
          $inc: {
            totalCount: 1,
            usersAffected: 1,
          },
        }
        : {
          $inc: {
            totalCount: 1,
          },
        };

      return (await this.db.getConnection()
        .collection(`events:${projectId}`)
        .updateOne(query, updateQuery)).modifiedCount;
    } catch (err) {
      throw new DatabaseReadWriteError(err);
    }
  }

  /**
   * Saves event at the special aggregation collection
   *
   * @param {string} projectId - project's identifier
   * @param {string} eventHash - event hash
   * @param {string} eventTimestamp - timestamp of the last event
   * @param {string|null} repetitionId - event's last repetition id
   * @param {boolean} shouldIncrementAffectedUsers - whether to increment affected users
   * @returns {Promise<void>}
   */
  private async saveDailyEvents(
    projectId: string,
    eventHash: string,
    eventTimestamp: number,
    repetitionId: string | null,
    shouldIncrementAffectedUsers: boolean
  ): Promise<void> {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('GrouperWorker.saveDailyEvents: Project ID is invalid or missed');
    }

    try {
      const midnight = this.getMidnightByEventTimestamp(eventTimestamp);

      await this.db.getConnection()
        .collection(`dailyEvents:${projectId}`)
        .updateOne(
          {
            groupHash: eventHash,
            groupingTimestamp: midnight,
          },
          {
            $set: {
              groupHash: eventHash,
              groupingTimestamp: midnight,
              lastRepetitionTime: eventTimestamp,
              lastRepetitionId: repetitionId,
            },
            $inc: {
              count: 1,
              affectedUsers: shouldIncrementAffectedUsers ? 1 : 0,
            },
          },
          { upsert: true });
    } catch (err) {
      throw new DatabaseReadWriteError(err);
    }
  }

  /**
   * Gets the midnight timestamp for the event date or the next day
   *
   * @param eventTimestamp - Unix timestamp of the event
   * @param getNext - If true, returns the next day's midnight timestamp
   */
  private getMidnightByEventTimestamp(eventTimestamp: number, getNext = false): number {
    /**
     * Get JavaScript date from event unixtime to convert daily aggregation collection format
     *
     * Problem was issued due to the numerous events that could be occurred in the past
     * but the date always was current
     */
    const eventDate = new Date(eventTimestamp * MS_IN_SEC);

    if (getNext) {
      eventDate.setUTCDate(eventDate.getUTCDate() + 1);
    }

    eventDate.setUTCHours(0, 0, 0, 0);

    return eventDate.getTime() / MS_IN_SEC;
  }
}
