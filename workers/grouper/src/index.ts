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
    await this.db.connect();
    this.prepareCache();
    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    await super.finish();
    this.prepareCache();
    await this.db.close();
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

    /**
     * Filter sensitive information
     */
    this.dataFilter.processEvent(task.event);

    if (isFirstOccurrence) {
      try {
        /**
         * Insert new event
         */
        await this.saveEvent(task.projectId, {
          groupHash: uniqueEventHash,
          totalCount: 1,
          catcherType: task.catcherType,
          payload: task.event,
          usersAffected: 1,
        } as GroupedEventDBScheme);
      } catch (e) {
        /**
         * If we caught Database duplication error, then another worker thread has already saved it to the database
         * and we need to process this event as repetition
         */
        if (e.code?.toString() === DB_DUPLICATE_KEY_ERROR) {
          HawkCatcher.send(new Error('[Grouper] MongoError: E11000 duplicate key error collection'));
          await this.handle(task);
        } else {
          throw e;
        }
      }
    } else {
      const incrementAffectedUsers = await this.shouldIncrementAffectedUsers(task, existedEvent);

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

    const eventUser = task.event.user;

    /**
     * Store events counter by days
     */
    await this.saveDailyEvents(task.projectId, uniqueEventHash, task.event.timestamp, repetitionId, eventUser?.id);

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
    const diffThreshold = 0.35;

    const lastUniqueEvents = await this.findLastEvents(projectId, eventsCountToCompare);

    return lastUniqueEvents.filter(prevEvent => {
      const distance = levenshtein(event.title, prevEvent.payload.title);
      const threshold = event.title.length * diffThreshold;

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
    const msInOneMinute = 60000;

    return this.cache.get(`last:${count}:eventsOf:${projectId}`, async () => {
      return this.db.getConnection()
        .collection(`events:${projectId}`)
        .find()
        .sort({
          _id: 1,
        })
        .limit(count)
        .toArray();
    }, msInOneMinute);
  }

  /**
   * Decides whether to increase the number of affected users.
   *
   * @param task - worker task to process
   * @param existedEvent - original event to get its user
   */
  private async shouldIncrementAffectedUsers(task: GroupWorkerTask, existedEvent: GroupedEventDBScheme): Promise<boolean> {
    const eventUser = task.event.user;

    if (!eventUser) {
      return false;
    }
    const isUserFromOriginalEvent = existedEvent.payload.user?.id === eventUser.id;

    if (isUserFromOriginalEvent) {
      return false;
    } else {
      const repetitionCacheKey = `repetitions:${task.projectId}:${existedEvent.groupHash}:${eventUser.id}`;
      const repetition = await this.cache.get(repetitionCacheKey, async () => {
        return this.db.getConnection().collection(`repetitions:${task.projectId}`)
          .findOne({
            groupHash: existedEvent.groupHash,
            'payload.user.id': eventUser.id,
          });
      });

      if (repetition) {
        return false;
      }

      const isLocked = await this.redis.checkOrSetEventLock(existedEvent.groupHash, eventUser.id);

      return !isLocked;
    }
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
   * @param {string} userId - affected user id
   * @returns {Promise<void>}
   */
  private async saveDailyEvents(
    projectId: string,
    eventHash: string,
    eventTimestamp: number,
    repetitionId: string | null,
    userId = 'anonymous'
  ): Promise<void> {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('GrouperWorker.saveDailyEvents: Project ID is invalid or missed');
    }

    try {
      /**
       * Get JavaScript date from event unixtime to convert daily aggregation collection format
       *
       * Problem was issued due to the numerous events that could be occurred in the past
       * but the date always was current
       */
      const eventDate = new Date(eventTimestamp * MS_IN_SEC);

      eventDate.setUTCHours(0, 0, 0, 0); // 00:00 UTC
      const midnight = eventDate.getTime() / MS_IN_SEC;

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
            $inc: { count: 1 },
            $addToSet: { affectedUsers: userId },
          },
          { upsert: true });
    } catch (err) {
      throw new DatabaseReadWriteError(err);
    }
  }
}
