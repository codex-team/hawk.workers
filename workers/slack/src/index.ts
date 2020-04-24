import {Worker} from "../../../lib/worker";
import {WorkerTask} from "../../../lib/types/worker-task";
import * as pkg from '../package.json';
import {DatabaseController} from "../../../lib/db/controller";
import {Sender} from "./provider/sender";
import WebhookSender from "./provider/webhook";
import {Renderer} from "./renderer";
import {TemplateEventData} from "../types/template-variables";
import {GroupedEvent} from 'hawk-worker-grouper/types/grouped-event';

/**
 * Slacker sender worker
 */
export default class SlackSender extends Worker {
  /**
   * Worker type
   */
  public readonly type: string = pkg.workerType;

  /**
   * Database controllers
   */
  private eventsDb: DatabaseController = new DatabaseController();
  private accountsDb: DatabaseController = new DatabaseController();

  /**
   * Slack sender provider
   */
  private sender: Sender = new WebhookSender();

  /**
   * Slack template renderer
   */
  private renderer: Renderer = new Renderer();

  /**
   * Initialize and start consuming
   */
  public async start(): Promise<void> {
    await this.accountsDb.connect(process.env.ACCOUNTS_DB_NAME);
    await this.eventsDb.connect(process.env.EVENTS_DB_NAME);
    await super.start();
  }

  /**
   * Close connections and stop consuming
   */
  public async finish(): Promise<void> {
    await this.accountsDb.close();
    await this.eventsDb.close();
    await super.finish();
  }

  /**
   * Handles message from queue broker
   *
   * @param {WorkerTask} task
   */
  protected async handle({projectId, ruleId, events}): Promise<void> {
    // const project = await this.getProject(projectId);
    // const rule = project.notifications.find((r) => r._id.toString() === ruleId);
    //
    // if (!project || !rule) {
    //   return;
    // }
    //
    // const endpoint = rule.channels.slack;
    this.renderer.renderNewEvent({} as TemplateEventData);

    /**
     * Send single Event
     */
    if (events.length === 1) {
      // const {
      //   key: groupHash,
      //   count
      // } = events[0];
      //
      // const [event, daysRepeated] = await this.getEventDataByGroupHash(projectId, groupHash);
      //
      // const message = this.renderer.renderNewEvent({
      //   event,
      //   daysRepeated,
      //   count
      // });
      //
      // await this.sender.send(
      //   endpoint,
      //   message
      // );
    }

    /**
     * Send Multiple Events
     */
    if (events.length > 1) {
      // const eventsData = await Promise.all(events.map(async ({key: groupHash, count}): Promise<TemplateEventData> => {
      //   const [event, daysRepeated] = await this.getEventDataByGroupHash(projectId, groupHash);
      //
      //   return {
      //     event,
      //     daysRepeated,
      //     count,
      //   };
      // })) as TemplateEventData[];

      // const message = this.renderer.renderEvents(eventsData);
      // await this.sender.send(
      //   endpoint,
      //   message
      // );
    }
  }

  /**
   * Get project info
   *
   * @param {string} projectId - project id
   * @return {Promise<Project>}
   */
  // private async getProject(projectId: string): Promise<Project> {
  //   const connection = await this.accountsDb.getConnection();
  //
  //   return connection.collection('projects').findOne({_id: new ObjectID(projectId)});
  // }

  /**
   * Get event and days repeating number by groupHash
   *
   * @param {string} projectId - project's identifier
   * @param {string} groupHash - event's grouping hash
   */
  private async getEventDataByGroupHash(
    projectId: string,
    groupHash: string,
  ): Promise<[GroupedEvent, number]> {
    const connection = this.eventsDb.getConnection();
    const event = await connection.collection(`events:${projectId}`).findOne({ groupHash });
    const daysRepeated = await connection.collection(`dailyEvents:${projectId}`).countDocuments({
      groupHash,
    });

    return [
      event,
      daysRepeated
    ];
  }

}
