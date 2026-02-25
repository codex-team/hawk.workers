import './env';
import * as crypto from 'crypto';
import * as mongodb from 'mongodb';
import { DatabaseController } from '../../../lib/db/controller';
import { Worker } from '../../../lib/worker';
import * as WorkerNames from '../../../lib/workerNames';
import * as pkg from '../package.json';
import type { GroupWorkerTask, RepetitionDelta } from '../types/group-worker-task';
import type {
  EventAddons,
  EventData,
  GroupedEventDBScheme,
  BacktraceFrame,
  SourceCodeLine,
  ProjectEventGroupingPatternsDBScheme,
  ErrorsCatcherType
} from '@hawk.so/types';
import type { RepetitionDBScheme } from '../types/repetition';
import { DatabaseReadWriteError, DiffCalculationError, ValidationError } from '../../../lib/workerErrors';
import { decodeUnsafeFields, encodeUnsafeFields } from '../../../lib/utils/unsafeFields';
import { MS_IN_SEC } from '../../../lib/utils/consts';
import TimeMs from '../../../lib/utils/time';
import DataFilter from './data-filter';
import RedisHelper from './redisHelper';
import { computeDelta } from './utils/repetitionDiff';
import { rightTrim } from '../../../lib/utils/string';
import { hasValue } from '../../../lib/utils/hasValue';
import GrouperMetrics from './metrics/grouperMetrics';
import GrouperMemoryMonitor from './metrics/memoryMonitor';
import { grouperMemoryConfig } from './metrics/config';

/**
 * eslint does not count decorators as a variable usage
 */
/* eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars */
import { memoize } from '../../../lib/memoize';

/**
 * eslint does not count decorators as a variable usage
 */
/* eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars */
const MEMOIZATION_TTL = 600_000;

/**
 * Cache cleanup interval in minutes
 */
const CACHE_CLEANUP_INTERVAL_MINUTES = 5;

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
   * Prometheus metrics facade.
   */
  private grouperMetrics = new GrouperMetrics();

  /**
   * Memory leak monitoring helper.
   */
  private memoryMonitor = new GrouperMemoryMonitor(this.logger, grouperMemoryConfig);

  /**
   * Interval for periodic cache cleanup to prevent memory leaks from unbounded cache growth
   */
  private cacheCleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Number of handled tasks in current worker process.
   */
  private handledTasksCount = 0;

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

    /**
     * Start periodic cache cleanup to prevent memory leaks from unbounded cache growth
     * Runs every 5 minutes to clear old cache entries
     */
    this.cacheCleanupInterval = setInterval(() => {
      this.clearCache();
    }, CACHE_CLEANUP_INTERVAL_MINUTES * TimeMs.MINUTE);
    this.memoryMonitor.initialize(this.handledTasksCount);

    await super.start();
  }

  /**
   * Finish everything
   */
  public async finish(): Promise<void> {
    /**
     * Clear cache cleanup interval to prevent resource leaks
     */
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }

    this.memoryMonitor.logShutdown(this.handledTasksCount);
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
  public async handle(task: GroupWorkerTask<ErrorsCatcherType>): Promise<void> {
    try {
      await this.grouperMetrics.observeHandleDuration(async () => {
        await this.handleInternal(task);
      });
    } catch (error) {
      this.grouperMetrics.incrementErrorsTotal();
      this.memoryMonitor.logHandleError(this.handledTasksCount, task.payload?.title);
      throw error;
    }
  }

  /**
   * Internal task handling function
   *
   * @param task - event to handle
   */
  private async handleInternal(task: GroupWorkerTask<ErrorsCatcherType>): Promise<void> {
    const taskPayloadSize = Buffer.byteLength(JSON.stringify(task.payload));
    const handledTasksCount = ++this.handledTasksCount;
    const memoryBeforeHandle = process.memoryUsage();

    this.grouperMetrics.observePayloadSize(taskPayloadSize);
    this.memoryMonitor.logBeforeHandle(memoryBeforeHandle, handledTasksCount, taskPayloadSize);

    this.logger.info(`[handle] project=${task.projectId} catcher=${task.catcherType} title="${task.payload.title}" payloadSize=${taskPayloadSize}b backtraceFrames=${task.payload.backtrace?.length ?? 0}`);

    // FIX RELEASE TYPE
    // TODO: REMOVE AFTER 01.01.2026, after the most of the users update to new js catcher
    if (task.payload && task.payload.release !== undefined) {
      task.payload = {
        ...task.payload,
        release: String(task.payload.release),
      };
    }

    let uniqueEventHash = '';
    let existedEvent: GroupedEventDBScheme;
    let isFirstOccurrence = false;
    let repetitionId = null;
    let incrementDailyAffectedUsers = false;

    /**
     * Trim source code lines to prevent memory leaks
     */
    this.trimSourceCodeLines(task.payload);

    /**
     * Filter sensitive information
     */
    this.dataFilter.processEvent(task.payload);

    while (true) {
      uniqueEventHash = await this.getUniqueEventHash(task);

      /**
       * Find similar events by grouping pattern
       */
      const similarEvent = await this.findSimilarEvent(task.projectId, task.payload.title);

      if (similarEvent) {
        this.logger.info(`[handle] similar event found, groupHash=${similarEvent.groupHash} totalCount=${similarEvent.totalCount}`);

        /**
         * Override group hash with found event's group hash
         */
        uniqueEventHash = similarEvent.groupHash;

        existedEvent = similarEvent;
      } else {
        /**
         * If we couldn't group by grouping pattern вЂ” try grouping by hash (title)
         */
        /**
         * Find event by group hash.
         */
        existedEvent = await this.getEvent(task.projectId, uniqueEventHash);
      }

      /**
       * Event happened for the first time
       */
      isFirstOccurrence = !existedEvent && !similarEvent;

      if (isFirstOccurrence) {
        try {
          const incrementAffectedUsers = !!task.payload.user;

          this.logger.info(`[saveEvent] new event, payloadSize=${taskPayloadSize}b`);

          /**
           * Insert new event
           */
          await this.saveEvent(task.projectId, {
            groupHash: uniqueEventHash,
            totalCount: 1,
            catcherType: task.catcherType,
            payload: task.payload,
            timestamp: task.timestamp,
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
          break;
        } catch (e) {
          /**
           * If we caught Database duplication error, then another worker thread has already saved it to the database
           * and we need to process this event as repetition
           */
          if (e.code?.toString() === DB_DUPLICATE_KEY_ERROR) {
            this.grouperMetrics.incrementDuplicateRetriesTotal();
            this.logger.info(`[saveEvent] duplicate key, retrying as repetition`);

            continue;
          }

          throw e;
        }
      }

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

      const existedPayloadSize = Buffer.byteLength(JSON.stringify(existedEvent.payload));

      this.logger.info(`[computeDelta] existedPayloadSize=${existedPayloadSize}b taskPayloadSize=${taskPayloadSize}b`);

      try {
        /**
         * Calculate delta between original event and repetition
         */
        delta = computeDelta(existedEvent.payload, task.payload);
      } catch (e) {
        console.error(e);
        throw new DiffCalculationError(e, existedEvent.payload, task.payload);
      }

      const deltaStr = JSON.stringify(delta);
      const deltaSize = deltaStr != null ? Buffer.byteLength(deltaStr) : 0;

      this.grouperMetrics.observeDeltaSize(deltaSize);

      this.logger.info(`[computeDelta] deltaSize=${deltaSize}b`);

      const newRepetition = {
        groupHash: uniqueEventHash,
        delta: deltaStr,
        timestamp: task.timestamp,
      } as RepetitionDBScheme;

      repetitionId = await this.saveRepetition(task.projectId, newRepetition);

      /**
       * Clear the large event payload references to allow garbage collection
       * This prevents memory leaks from retaining full event objects after delta is computed
       */
      delta = undefined;
      break;
    }

    /**
     * Increment metrics counter once per handled task
     */
    this.grouperMetrics.incrementEventsTotal(isFirstOccurrence ? 'new' : 'repeated');

    /**
     * Store events counter by days
     */
    await this.saveDailyEvents(
      task.projectId,
      uniqueEventHash,
      task.timestamp,
      repetitionId,
      incrementDailyAffectedUsers
    );

    this.memoryMonitor.logHandleCompletion(
      memoryBeforeHandle,
      handledTasksCount,
      taskPayloadSize,
      task.payload.title,
      task.projectId
    );

    /**
     * Add task for NotifierWorker only if event is not ignored
     */
    if (process.env.IS_NOTIFIER_WORKER_ENABLED) {
      const isIgnored = isFirstOccurrence ? false : !!existedEvent?.marks?.ignored;

      if (!isIgnored) {
        await this.addTask(WorkerNames.NOTIFIER, {
          projectId: task.projectId,
          event: {
            title: task.payload.title,
            groupHash: uniqueEventHash,
            isNew: isFirstOccurrence,
            repetitionId: repetitionId ? repetitionId.toString() : null,
          },
        });
      }
    }
  }

  /**
   * Trims source code lines in event's backtrace to prevent memory leaks
   *
   * @param event - event to process
   */
  private trimSourceCodeLines(event: EventData<EventAddons>): void {
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

    /**
     * Normalize backtrace, if backtrace equals to [] it leads to visual bugs
     */
    if (event.backtrace.length === 0) {
      event.backtrace = null;
    }
  }

  /**
   * Get unique hash based on event type and title
   *
   * @param task - worker task to create hash
   */
  private getUniqueEventHash<Type extends ErrorsCatcherType>(task: GroupWorkerTask<Type>): Promise<string> {
    return this.cache.get(`groupHash:${task.projectId}:${task.catcherType}:${task.payload.title}`, () => {
      return crypto.createHmac('sha256', process.env.EVENT_SECRET)
        .update(task.catcherType + task.payload.title)
        .digest('hex');
    });
  }

  /**
   * Method that is used to retrieve the first original event that satisfies the grouping pattern
   *
   * @param pattern - event should satisfy this pattern
   * @param projectId - id of the project to find event in
   */
  private async findFirstEventByPattern(pattern: string, projectId: string): Promise<GroupedEventDBScheme> {
    return await this.eventsDb.getConnection()
      .collection(`events:${projectId}`)
      .findOne(
        { 'payload.title': { $regex: pattern } }
      );
  }

  /**
   * Tries to find events with a small Levenshtein distance of a title or by matching grouping patterns
   *
   * @param projectId - where to find
   * @param title - title of the event to find similar one
   */
  @memoize({ max: 50, ttl: MEMOIZATION_TTL, strategy: 'hash', skipCache: [undefined] })
  private async findSimilarEvent(projectId: string, title: string): Promise<GroupedEventDBScheme | undefined> {
    /**
     * If no match by Levenshtein, try matching by patterns
     */
    const patterns = await this.getProjectPatterns(projectId);

    if (patterns && patterns.length > 0) {
      const matchingPattern = await this.findMatchingPattern(patterns, title);

      if (matchingPattern !== null && matchingPattern !== undefined) {
        try {
          const originalEvent = await this.findFirstEventByPattern(matchingPattern.pattern, projectId);

          this.logger.info(`[findSimilarEvent] found by pattern, groupHash=${originalEvent?.groupHash} title="${originalEvent?.payload?.title}"`);

          if (originalEvent) {
            return originalEvent;
          }
        } catch (e) {
          this.logger.error(`Error while getting original event for pattern ${matchingPattern}: ${e.message}`);
        }
      }
    }

    return undefined;
  }

  /**
   * Method that returns matched pattern for event, if event do not match any of patterns return null
   *
   * @param patterns - list of the patterns of the related project
   * @param title - title of the event to check for pattern match
   * @returns {ProjectEventGroupingPatternsDBScheme | null} matched pattern object or null if no match
   */
  private async findMatchingPattern(
    patterns: ProjectEventGroupingPatternsDBScheme[],
    title: string
  ): Promise<ProjectEventGroupingPatternsDBScheme | null> {
    if (!patterns || patterns.length === 0) {
      return null;
    }

    return patterns.filter(pattern => {
      const patternRegExp = new RegExp(pattern.pattern);

      return title.match(patternRegExp);
    }).pop() || null;
  }

  /**
   * Method that gets event patterns for a project
   *
   * @param projectId - id of the project to find related event patterns
   * @returns {ProjectEventGroupingPatternsDBScheme[]} EventPatterns object with projectId and list of patterns
   */
  private async getProjectPatterns(projectId: string): Promise<ProjectEventGroupingPatternsDBScheme[]> {
    const project = await this.accountsDb.getConnection()
      .collection('projects')
      .findOne({
        _id: new mongodb.ObjectId(projectId),
      });

    return project?.eventGroupingPatterns || [];
  }

  /**
   * Decides whether to increase the number of affected users for the repetition and the daily aggregation
   *
   * @param task - worker task to process
   * @param existedEvent - original event to get its user
   * @returns {[boolean, boolean]} - whether to increment affected users for the repetition and the daily aggregation
   */
  private async shouldIncrementAffectedUsers<Type extends ErrorsCatcherType>(task: GroupWorkerTask<Type>, existedEvent: GroupedEventDBScheme): Promise<[boolean, boolean]> {
    const eventUser = task.payload.user;

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
    const eventMidnight = this.getMidnightByEventTimestamp(task.timestamp);
    const eventNextMidnight = this.getMidnightByEventTimestamp(task.timestamp, true);

    /**
     * Check if incoming event has the same day as the original event
     */
    const isSameDay = existedEvent.timestamp > eventMidnight && existedEvent.timestamp < eventNextMidnight;

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
            timestamp: {
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
      return this.grouperMetrics.observeMongoDuration('getEvent', async () => {
        return this.eventsDb.getConnection()
          .collection(`events:${projectId}`)
          .findOne({
            groupHash,
          })
          .catch((err) => {
            throw new DatabaseReadWriteError(err);
          });
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

    return this.grouperMetrics.observeMongoDuration('saveEvent', async () => {
      const collection = this.eventsDb.getConnection().collection(`events:${projectId}`);

      encodeUnsafeFields(groupedEventData);

      return (await collection
        .insertOne(groupedEventData)).insertedId as mongodb.ObjectID;
    });
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

    return this.grouperMetrics.observeMongoDuration('saveRepetition', async () => {
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
    });
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

    return this.grouperMetrics.observeMongoDuration('incrementCounter', async () => {
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
    });
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

    await this.grouperMetrics.observeMongoDuration('saveDailyEvents', async () => {
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
    });
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
