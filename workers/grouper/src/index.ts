import * as crypto from 'crypto';
import * as mongodb from 'mongodb';
import { DatabaseController } from '../../../lib/db/controller';
import * as utils from '../../../lib/utils';
import { Worker } from '../../../lib/worker';
import * as WorkerNames from '../../../lib/workerNames';
import * as pkg from '../package.json';
import { GroupWorkerTask } from '../types/group-worker-task';
import { GroupedEvent } from '../types/grouped-event';
import { Repetition } from '../types/repetition';
import { DatabaseError, ValidationError } from '../../../lib/workerErrors';

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
   * @param task - event to handle
   */
  public async handle(task: GroupWorkerTask): Promise<void> {
    const uniqueEventHash = crypto.createHmac('sha256', process.env.EVENT_SECRET)
      .update(task.catcherType + task.event.title)
      .digest('hex');

    // eslint-disable-next-line jsdoc/check-values
    /**
     * @since April 01, 2020
     * Do not save event with unexpected structure caused due to js-vue integration
     * @todo remove after changing payload data format
     */
    if (task.event.title === 'this.editor is undefined' && task.event.addons) {
      interface VueAddonsData {
        lifecycle: string;
        component: string;
        data: object;
        props: object;
        computed: object;
      }
      const vueAddons = (task.event.addons as {vue: VueAddonsData}).vue;

      if (vueAddons && vueAddons.data) {
        (task.event.addons as {vue: VueAddonsData}).vue.data = {};
      }
    }

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
      /**
       * Insert new event
       */
      await this.saveEvent(task.projectId, {
        groupHash: uniqueEventHash,
        totalCount: 1,
        catcherType: task.catcherType,
        payload: task.event,
      } as GroupedEvent);
    } else {
      /**
       * Increment existed task's counter
       */
      await this.incrementEventCounter(task.projectId, {
        groupHash: uniqueEventHash,
      });

      /**
       * Save event's repetitions
       */
      const diff = utils.deepDiff(existedEvent.payload, task.event);
      const repetition = {
        groupHash: uniqueEventHash,
        payload: diff,
      } as Repetition;

      repetitionId = await this.saveRepetition(task.projectId, repetition);
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
   * Returns finds event by query from project with passed ID
   *
   * @param projectId - project's identifier
   * @param query - mongo query string
   */
  private async getEvent(projectId: string, query): Promise<GroupedEvent> {
    if (!mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveEvent: Project ID is invalid or missed');
    }

    try {
      return this.db.getConnection()
        .collection(`events:${projectId}`)
        .findOne(query);
    } catch (err) {
      throw new DatabaseError(err);
    }
  }

  /**
   * Save event to database
   *
   * @param projectId - project id
   * @param groupedEventData - event data
   * @throws {ValidationError} if `projectID` is not provided or invalid
   * @throws {ValidationError} if `eventData` is not a valid object
   */
  private async saveEvent(projectId: string, groupedEventData: GroupedEvent): Promise<mongodb.ObjectID> {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveEvent: Project ID is invalid or missed');
    }

    try {
      return (await this.db.getConnection()
        .collection(`events:${projectId}`)
        .insertOne(groupedEventData)).insertedId as mongodb.ObjectID;
    } catch (err) {
      throw new DatabaseError(err);
    }
  }

  /**
   * Inserts unique event repetition to the database
   *
   * @param projectId - project's identifier
   * @param {Repetition} repetition - object that contains only difference with first event
   */
  private async saveRepetition(projectId: string, repetition: Repetition): Promise<mongodb.ObjectID> {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveRepetition: Project ID is invalid or missing');
    }

    try {
      const collection = this.db.getConnection().collection(`repetitions:${projectId}`);
      const result = (await collection.insertOne(repetition)).insertedId as mongodb.ObjectID;

      const hasIndex = await collection.indexExists('groupHash_hashed');

      if (!hasIndex) {
        await collection.createIndex({
          groupHash: 'hashed',
        });
      }

      return result;
    } catch (err) {
      throw new DatabaseError(err);
    }
  }

  /**
   * If event in project exists this method increments counter
   *
   * @param projectId - project id to increment
   * @param query - query to get event
   */
  private async incrementEventCounter(projectId, query): Promise<number> {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveEvent: Project ID is invalid or missed');
    }

    try {
      return (await this.db.getConnection()
        .collection(`events:${projectId}`)
        .updateOne(query, {
          $inc: {
            totalCount: 1,
          },
        })).modifiedCount;
    } catch (err) {
      throw new DatabaseError(err);
    }
  }

  /**
   * saves event at the special aggregation collection
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
      const eventDate = new Date(eventTimestamp * 1000);

      eventDate.setHours(0, 0, 0, 0); // get midnight
      const midnight = eventDate.getTime() / 1000;

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
      throw new DatabaseError(err);
    }
  }
}
