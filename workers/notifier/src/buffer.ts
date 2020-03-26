import Timeout = NodeJS.Timeout;

interface Index<T> {
  [key: string]: T;
}

interface ChannelSchema {
  payload: Index<number>;
  timer: Timeout;
}

export interface BufferData {
  key: string;
  count: number;
}

type RuleSchema = Index<ChannelSchema>;
type ProjectSchema = Index<RuleSchema>;
type BufferSchema = Index<ProjectSchema>;

export type ChannelKey = [string, string, string];
export type EventKey = [string, string, string, string];

export default class Buffer {
  private projects: BufferSchema = {};

  public push(key: EventKey): void {
    const eventKey = key[3];
    const channel = this.getChannel(key.slice(0, -1) as ChannelKey);

    this.getField(channel.payload, eventKey, 0);

    channel.payload[eventKey]++;
  }

  public get(key: ChannelKey): BufferData[];
  public get(key: EventKey): number;
  public get(arg) {
    const [projectId, ruleId, channelName, key] = arg;

    const channel = this.getChannel([projectId, ruleId, channelName]);

    if (key) {
      return channel.payload[key];
    }

    return Object
      .entries(channel.payload)
      .map(([k, count]) => ({key: k, count}));
  }

  public size(key: ChannelKey): number {
    return this.get(key).length;
  }

  public setTimer(key: ChannelKey, timeout: number, callback: (...args: any[]) => void) {
    const channel = this.getChannel(key);

    channel.timer = setTimeout(
      callback,
      timeout,
      key,
    );

    return channel.timer;
  }

  public getTimer(key: ChannelKey): Timeout {
    const channel = this.getChannel(key);

    return channel.timer;
  }

  public clearTimer(key: ChannelKey): void {
    const channel = this.getChannel(key);

    clearTimeout(channel.timer);

    channel.timer = null;
  }

  public flush(key: ChannelKey): BufferData[] {
    const channel = this.getChannel(key);

    const data = this.get(key);

    channel.payload = {};

    return data;
  }

  public flushAll(projectId?: string): void {
    if (projectId) {
      this.projects[projectId] = {};
      return;
    }

    this.projects = {};
  }

  private getChannel([projectId, ruleId, channelName]: ChannelKey): ChannelSchema {
    const project = this.getField<BufferSchema, ProjectSchema>(
      this.projects,
      projectId,
      {},
    );
    const rule = this.getField<ProjectSchema, RuleSchema>(
      project,
      ruleId,
      {},
      );

    return this.getField<RuleSchema, ChannelSchema>(
      rule,
      channelName,
      {payload: {}, timer: null},
    );
  }

  private getField<T = any, V = any>(
    obj: T,
    field: string,
    defaultValue: V,
  ): V {
    if (!(field in obj)) {
      obj[field] = defaultValue;
    }

    return obj[field];
  }
}
