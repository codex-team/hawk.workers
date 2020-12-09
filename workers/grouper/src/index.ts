import * as crypto from 'crypto';
import * as mongodb from 'mongodb';
import { DatabaseController } from '../../../lib/db/controller';
import * as utils from '../../../lib/utils';
import { Worker } from '../../../lib/worker';
import * as WorkerNames from '../../../lib/workerNames';
import * as pkg from '../package.json';
import { GroupWorkerTask } from '../types/group-worker-task';
import { GroupedEventDBScheme, RepetitionDBScheme } from 'hawk.types';
import { DatabaseReadWriteError, ValidationError } from '../../../lib/workerErrors';
import { decodeUnsafeFields, encodeUnsafeFields } from '../../../lib/utils/unsafeFields';
import HawkCatcher from '@hawk.so/nodejs';
import { MS_IN_SEC } from '../../../lib/utils/consts';

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
   * Memoized Hashing computation
   */
  private static cachedHashValues: {[key: string]: string} = {};

  /**
   * Database Controller
   */
  private db: DatabaseController = new DatabaseController(process.env.MONGO_EVENTS_DATABASE_URI);

  /**
   * Get unique hash from event data
   *
   * @param task - worker task to create hash
   */
  private static getUniqueEventHash(task: GroupWorkerTask): string {
    const computedHashValueCacheKey = `${task.catcherType}:${task.event.title}`;

    if (!this.cachedHashValues[computedHashValueCacheKey]) {
      this.cachedHashValues[computedHashValueCacheKey] = crypto.createHmac('sha256', process.env.EVENT_SECRET)
        .update(task.catcherType + task.event.title)
        .digest('hex');
    }

    return this.cachedHashValues[computedHashValueCacheKey];
  }

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
    await this.db.close();
  }

  /**
   * Task handling function
   *
   * @param task - event to handle
   */
  public async handle(task: GroupWorkerTask): Promise<void> {
    const uniqueEventHash = GrouperWorker.getUniqueEventHash(task);

    /**
     * Find event by group hash.
     */
    const existedEvent = await this.getEvent(task.projectId, {
      groupHash: uniqueEventHash,
    });

    /**
     * Event happened for the first time
     */
    const isFirstOccurrence = existedEvent === null;

    let repetitionId = null;

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
        if (e.code.toString() === DB_DUPLICATE_KEY_ERROR) {
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

      /**
       * Save event's repetitions
       */
      const diff = utils.deepDiff(existedEvent.payload, task.event);
      const newRepetition = {
        groupHash: uniqueEventHash,
        payload: diff,
      } as RepetitionDBScheme;

      repetitionId = await this.saveRepetition(task.projectId, newRepetition);
    }

    /**
     * Store events counter by days
     */
    await this.saveDailyEvents(task.projectId, uniqueEventHash, task.event.timestamp, repetitionId);

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
      const repetition = this.cache.get(repetitionCacheKey, () => {
        return this.db.getConnection().collection(`repetitions:${task.projectId}`)
          .findOne({
            groupHash: existedEvent.groupHash,
            'payload.user.id': eventUser.id,
          });
      });

      /**
       * If there is no repetitions from this user — return true
       */
      return !repetition;
    }
  }

  /**
   * Returns finds event by query from project with passed ID
   *
   * @param projectId - project's identifier
   * @param query - mongo query string
   */
  private async getEvent(projectId: string, query): Promise<GroupedEventDBScheme> {
    if (!mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveEvent: Project ID is invalid or missed');
    }

    const eventCacheKey = `${projectId}:${query.toString()}`;

    return this.cache.get(eventCacheKey, () => {
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
      throw new DatabaseReadWriteError(err);
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
   * @returns {Promise<void>}
   */
  private async saveDailyEvents(
    projectId: string,
    eventHash: string,
    eventTimestamp: number,
    repetitionId: string | null
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
          },
          { upsert: true });
    } catch (err) {
      throw new DatabaseReadWriteError(err);
    }
  }
}
