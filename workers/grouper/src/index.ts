import { Worker, ValidationError, DatabaseError } from '../../../lib/worker';
import { GroupWorkerTask } from '../types/group-worker-task';
import { GroupedEvent } from '../types/grouped-event';
import { Repetition } from '../types/repetition';
import { DatabaseController } from '../../../lib/db/controller';
import * as mongodb from 'mongodb';
import * as utils from '../../../lib/utils';
import * as crypto from 'crypto';
import * as pkg from '../package.json';

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
  private db: DatabaseController = new DatabaseController();

  /**
   * Create new instance
   */
  constructor() {
    super();
  }

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
   */
  public async handle(task: GroupWorkerTask): Promise<void> {
    const uniqueEventHash = crypto.createHmac('sha256', process.env.EVENT_SECRET)
      .update(task.catcherType + task.event.title)
      .digest('hex');

    /**
     * Find event by group hash.
     */
    const existedEvent = await this.getEvent(task.projectId, {
      groupHash: uniqueEventHash
    });

    /**
     * Event happened for the first time
     */
    const isFirstOccurrence = existedEvent === null;

    if (isFirstOccurrence) {
      /**
       * Insert new event
       */
      await this.saveEvent(task.projectId, {
        groupHash: uniqueEventHash,
        count: 1,
        catcherType: task.catcherType,
        payload: task.event
      } as GroupedEvent);
    } else {
      /**
       * Increment existed task's counter
       */
      await this.incrementEventCounter(task.projectId, {
        groupHash: uniqueEventHash
      });

      /**
       * Save event's repetitions
       */
      const diff = Object.assign(
        utils.deepDiff(existedEvent.payload, task.event),
        {
          groupHash: uniqueEventHash
        }
      ) as Repetition;
      await this.saveRepetition(task.projectId, diff);
    }

    /**
     * Store events counter by days
     */
    await this.saveDailyEvents(task.projectId, uniqueEventHash, task.event.timestamp);
  }

  /**
   * Returns finds event by query from project with passed ID
   *
   * @param {string} projectId - project's identifier
   * @param {EventSchema} query - mongo query string
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
   * @param {string|ObjectID} projectId - project id
   * @param {{groupHash: string, count: number, catcherType: string, payload: object}} groupedEventData - event data
   * @throws {ValidationError} if `projectID` is not provided or invalid
   * @throws {ValidationError} if `eventData` is not a valid object
   * @returns {Promise<ObjectID>} saved event id
   */
  private async saveEvent(projectId, groupedEventData): Promise<mongodb.ObjectID> {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveEvent: Project ID is invalid or missed');
    }

    try {
      return (await this.db.getConnection()
        .collection(`events:${projectId}`)
        .insertOne(groupedEventData)).insertedId  as mongodb.ObjectID;
    } catch (err) {
      throw new DatabaseError(err);
    }
  }

  /**
   * Inserts unique event repetition to the database
   *
   * @param {string|ObjectID} projectId - project's identifier
   * @param {object} eventDiff - object that contains only difference with first event
   */
  private async saveRepetition(projectId, eventDiff: Repetition): Promise<mongodb.ObjectID> {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('Controller.saveEvent: Project ID is invalid or missing');
    }

    try {
      return (await this.db.getConnection()
        .collection(`repetitions:${projectId}`)
        .insertOne(eventDiff)).insertedId as mongodb.ObjectID;
    } catch (err) {
      throw new DatabaseError(err);
    }
  }

  /**
   * If event in project exists this method increments counter
   *
   * @param {string|ObjectID} projectId
   * @param {EventSchema} query
   * @return {Promise<number>} — modified docs count
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
            count: 1
          }
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
   * @return {Promise<void>}
   */
  private async saveDailyEvents(projectId: string, eventHash: string, eventTimestamp: number): Promise<void> {
    if (!projectId || !mongodb.ObjectID.isValid(projectId)) {
      throw new ValidationError('GrouperWorker.saveDailyEvents: Project ID is invalid or missed');
    }

    try {
      const now = new Date();
      const day = now.getDate();
      const month = now.getMonth() + 1;

      const currentDate = [
        (day > 9 ? '' : '0') + day,
        (month > 9 ? '' : '0') + month,
        now.getFullYear()
      ].join('-');

      await this.db.getConnection()
        .collection(`dailyEvents:${projectId}`)
        .updateOne(
          { groupHash: eventHash, date: currentDate },
          {
            $set: { groupHash: eventHash, date: currentDate, timestamp: eventTimestamp },
            $inc: { count: 1 }
          },
          { upsert: true });
    } catch (err) {
      throw new DatabaseError(err);
    }
  }
}
