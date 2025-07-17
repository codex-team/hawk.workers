import './env';
import * as crypto from 'crypto';
import * as mongodb from 'mongodb';
import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as WorkerNames from '../../../lib/workerNames';
import * as pkg from '../package.json';
import type { GroupWorkerTask, RepetitionDelta } from '../types/group-worker-task';
import type { EventAddons, EventDataAccepted, GroupedEventDBScheme, BacktraceFrame, SourceCodeLine, ProjectEventGroupingPatternsDBScheme } from '@hawk.so/types';
import type { RepetitionDBScheme } from '../types/repetition';
import { DatabaseReadWriteError, DiffCalculationError, ValidationError } from '../../../lib/workerErrors';
import { decodeUnsafeFields, encodeUnsafeFields } from '../../../lib/utils/unsafeFields';
import HawkCatcher from '@hawk.so/nodejs';
import { MS_IN_SEC } from '../../../lib/utils/consts';
import DataFilter from './data-filter';
import RedisHelper from './redisHelper';
import levenshtein from 'js-levenshtein';
import { computeDelta } from './utils/repetitionDiff';
import TimeMs from '../../../lib/utils/time';
import { rightTrim } from '../../../lib/utils/string';
import { hasValue } from '../../../lib/utils/hasValue';

/**
 * Error code of MongoDB key duplication error
 */
const DB_DUPLICATE_KEY_ERROR = '11000';

/**
 * Maximum length for backtrace code line or title
 */
const MAX_CODE_LINE_LENGTH = 140;

/**
 * Worker for handling Javascript events
 */
export default class GrouperWorker extends Worker {
  /**
   * Worker type
   */
  public readonly type: string = pkg.workerType;

  /**
   * Events database Controller
   */
  private eventsDb: DatabaseController = new DatabaseController(process.env.MONGO_EVENTS_DATABASE_URI);

  /**
   * Accounts database Controller
   */
  private accountsDb: DatabaseController = new DatabaseController(process.env.MONGO_ACCOUNTS_DATABASE_URI);

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

    await this.eventsDb.connect();
    await this.accountsDb.connect();
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
    await this.eventsDb.close();
    await this.accountsDb.close();
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
    let existedEvent = await this.getEvent(task.projectId, uniqueEventHash);

    /**
     * If we couldn't group by group hash (title), try grouping by Levenshtein distance or patterns
     */
    if (!existedEvent) {
      const similarEvent = await this.findSimilarEvent(task.projectId, task.event);

      if (similarEvent) {
        this.logger.info(`similar event: ${JSON.stringify(similarEvent)}`);
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
     * Trim source code lines to prevent memory leaks
     */
    this.trimSourceCodeLines(task.event);

    /**
     * Filter sensitive information
     */
    this.dataFilter.processEvent(task.event);

    if (isFirstOccurrence) {
      try {
        const incrementAffectedUsers = !!task.event.user;

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

        const eventCacheKey = await this.getEventCacheKey(task.projectId, uniqueEventHash);

        /**
         * If event is saved, then cached event state is no longer actual, so we should remove it
         */
        this.cache.del(eventCacheKey);

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

      let delta: RepetitionDelta;

      try {
        /**
         * Calculate delta between original event and repetition
         */
        delta = computeDelta(existedEvent.payload, task.event);
      } catch (e) {
        console.error(e);
        throw new DiffCalculationError(e, existedEvent.payload, task.event);
      }

      const newRepetition = {
        groupHash: uniqueEventHash,
        delta: JSON.stringify(delta),
        timestamp: task.event.timestamp,
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
   * Trims source code lines in event's backtrace to prevent memory leaks
   *
   * @param event - event to process
   */
  private trimSourceCodeLines(event: EventDataAccepted<EventAddons>): void {
    if (!event.backtrace) {
      return;
    }

    event.backtrace.forEach((frame: BacktraceFrame) => {
      if (!frame.sourceCode) {
        return;
      }

      frame.sourceCode = frame.sourceCode.map((line: SourceCodeLine) => {
        return {
          line: line.line,
          content: hasValue(line.content) ? rightTrim(line.content, MAX_CODE_LINE_LENGTH) : line.content,
        };
      });
    });
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
   * Tries to find events with a small Levenshtein distance of a title or by matching grouping patterns
   *
   * @param projectId - where to find
   * @param event - event to compare
   */
  private async findSimilarEvent(projectId: string, event: EventDataAccepted<EventAddons>): Promise<GroupedEventDBScheme | undefined> {
    const eventsCountToCompare = 60;
    const diffTreshold = 0.35;

    const lastUniqueEvents = await this.findLastEvents(projectId, eventsCountToCompare);

    /**
     * Trim titles to reduce CPU usage for Levenshtein comparison
     */
    const trimmedEventTitle = hasValue(event.title) ? rightTrim(event.title, MAX_CODE_LINE_LENGTH) : '';

    /**
     * First try to find by Levenshtein distance
     */
    const similarByLevenshtein = lastUniqueEvents.filter(prevEvent => {
      const trimmedPrevTitle = hasValue(prevEvent.payload.title) ? rightTrim(prevEvent.payload.title, MAX_CODE_LINE_LENGTH) : '';

      if (trimmedEventTitle === '' || trimmedPrevTitle === '') {
        return false;
      }

      const distance = levenshtein(trimmedEventTitle, trimmedPrevTitle);
      const threshold = trimmedEventTitle.length * diffTreshold;

      return distance < threshold;
    }).pop();

    if (similarByLevenshtein) {
      return similarByLevenshtein;
    }

    /**
     * If no match by Levenshtein, try matching by patterns
     */
    const patterns = await this.getProjectPatterns(projectId);

    if (patterns && patterns.length > 0) {
      const matchingPattern = await this.findMatchingPattern(patterns, event);

      if (matchingPattern !== null && matchingPattern !== undefined) {
        try {
          const originalEvent = await this.cache.get(`${projectId}:${matchingPattern._id}:originalEvent`, async () => {
            return await this.eventsDb.getConnection()
              .collection(`events:${projectId}`)
              .findOne(
                { 'payload.title': { $regex: matchingPattern.pattern } },
                { sort: { _id: 1 } }
              );
          });

          this.logger.info(`original event for pattern: ${JSON.stringify(originalEvent)}`);

          if (originalEvent) {
            return originalEvent;
          }
        } catch (e) {
          this.logger.error(`Error while getting original event for pattern ${matchingPattern}`);
        }
      }
    }

    return undefined;
  }

  /**
   * Method that returns matched pattern for event, if event do not match any of patterns return null
   *
   * @param patterns - list of the patterns of the related project
   * @param event - event which title would be cheched
   * @returns {ProjectEventGroupingPatternsDBScheme | null} matched pattern object or null if no match
   */
  private async findMatchingPattern(
    patterns: ProjectEventGroupingPatternsDBScheme[],
    event: EventDataAccepted<EventAddons>
  ): Promise<ProjectEventGroupingPatternsDBScheme | null> {
    if (!patterns || patterns.length === 0) {
      return null;
    }

    return patterns.filter(pattern => {
      const patternRegExp = new RegExp(pattern.pattern);

      return event.title.match(patternRegExp);
    }).pop() || null;
  }

  /**
   * Method that gets event patterns for a project
   *
   * @param projectId - id of the project to find related event patterns
   * @returns {ProjectEventGroupingPatternsDBScheme[]} EventPatterns object with projectId and list of patterns
   */
  private async getProjectPatterns(projectId: string): Promise<ProjectEventGroupingPatternsDBScheme[]> {
    return this.cache.get(`project:${projectId}:patterns`, async () => {
      const project = await this.accountsDb.getConnection()
        .collection('projects')
        .findOne({
          _id: new mongodb.ObjectId(projectId),
        });

      return project?.eventGroupingPatterns || [];
    },
    /**
     * Cache project patterns for 5 minutes since they don't change frequently
     */
    /* eslint-disable-next-line @typescript-eslint/no-magic-numbers */
    5 * TimeMs.MINUTE / MS_IN_SEC);
  }

  /**
   * Returns last N unique events by a project id
   *
   * @param projectId - where to find
   * @param count - how many events to return
   * @returns {GroupedEventDBScheme[]} list of the last N unique events
   */
  private findLastEvents(projectId: string, count: number): Promise<GroupedEventDBScheme[]> {
    return this.cache.get(`last:${count}:eventsOf:${projectId}`, async () => {
      return this.eventsDb.getConnection()
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
        return this.eventsDb.getConnection().collection(`repetitions:${task.projectId}`)
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
        return this.eventsDb.getConnection().collection(`repetitions:${task.projectId}`)
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
   * @param groupHash - group hash of the event
   */
  private async getEvent(projectId: string, groupHash: string): Promise<GroupedEventDBScheme> {
    if (!mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveEvent: Project ID is invalid or missed');
    }

    const eventCacheKey = await this.getEventCacheKey(projectId, groupHash);

    return this.cache.get(eventCacheKey, async () => {
      return this.eventsDb.getConnection()
        .collection(`events:${projectId}`)
        .findOne({
          groupHash,
        })
        .catch((err) => {
          throw new DatabaseReadWriteError(err);
        });
    });
  }

  /**
   * Method that returns event cache key based on projectId and groupHash
   *
   * @param projectId - used for cache key creation
   * @param groupHash - used for cache key creation
   * @returns {string} cache key for event
   */
  private async getEventCacheKey(projectId: string, groupHash: string): Promise<string> {
    return `${projectId}:${JSON.stringify({ groupHash })}`;
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

    const collection = this.eventsDb.getConnection().collection(`events:${projectId}`);

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
      const collection = this.eventsDb.getConnection().collection(`repetitions:${projectId}`);

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

      return (await this.eventsDb.getConnection()
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

      await this.eventsDb.getConnection()
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
