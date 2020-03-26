import { ObjectID } from 'mongodb';
import {DatabaseController} from '../../../lib/db/controller';
import {Worker} from '../../../lib/worker';
import * as pkg from '../package.json';
import {Channel} from '../types/channel';
import {NotifierWorkerTask} from '../types/notifier-task';
import {Rule} from '../types/rule';
import Buffer, {BufferData, ChannelKey, EventKey} from './buffer';
import RuleValidator from './validator';

export default class NotifierWorker extends Worker {
  public readonly type: string = pkg.workerType;

  private db: DatabaseController = new DatabaseController();
  private buffer: Buffer = new Buffer();

  public async start(): Promise<void> {
    await this.db.connect(process.env.ACCOUNTS_DB_NAME);
    await super.start();
  }

  public async finish(): Promise<void> {
    await super.finish();
    await this.db.close();
  }

  public async handle(task: NotifierWorkerTask): Promise<void> {
    const {projectId, event} = task;

    const rules = await this.getFittedRules(projectId, event);

    rules.forEach((rule) => {
      this.addEventToChannels(projectId, rule, event);
    });
  }

  private async getFittedRules(projectId: string, event): Promise<Rule[]> {
    const rules = await this.getProjectNotificationRules(projectId);

    return rules
      .filter((rule: any) => {
        try {
          new RuleValidator(rule, event).checkAll();
        } catch (e) {
          console.error(e);
          return false;
        }

        return true;
      });
  }

  private addEventToChannels(projectId, rule, event) {
    const channels: Array<[string, Channel]> = Object.entries(rule.channels);

    channels.forEach(([name, options]) => {
      if (!options.isEnabled) {
        return;
      }

      const channelKey: ChannelKey = [projectId, rule.id, name];
      const eventKey: EventKey = [projectId, rule.id, name, event.groupHash];

      if (this.buffer.getTimer(channelKey)) {
        this.buffer.push(eventKey);

        return;
      }

      this.sendToSenderWorker([projectId, rule.id, name], [{key: event.groupHash, count: 1}]);

      const minPeriod = (options.minPeriod || 60) * 1000;

      this.buffer.setTimer(channelKey, minPeriod, this.sendEvents);
    });
  }

  private sendEvents = (channelKey) => {
    const events = this.buffer.flush(channelKey);

    if (!events.length) {
      return;
    }

    this.sendToSenderWorker(channelKey, events);
  }

  private sendToSenderWorker(key: ChannelKey, events: BufferData[]): void {
    console.log(key, events);
  }

  private async getProjectNotificationRules(projectId: string): Promise<Rule[]> | never  {
    const connection = this.db.getConnection();
    const projects = connection.collection('projects');

    const project = await projects.findOne({_id : new ObjectID(projectId)});

    if (!project) {
      throw Error('There is no project with given id');
    }

    return project.notifications || [];
  }
}
