import Timeout = NodeJS.Timeout;

/**
 * Index signature generic helper
 */
interface Index<T> {
  [key: string]: T;
}

/**
 * Buffer channel object schema
 */
interface ChannelSchema {
  /**
   * Object which keys are events' group hash
   * and values are number of events received for minPeriod
   */
  payload: Index<number>;

  /**
   * Channel timer
   */
  timer: Timeout;
}

/**
 * Events data schema
 */
export interface BufferData {
  /**
   * Group hash
   */
  key: string;

  /**
   * Number of events received for minPeriod
   */
  count: number;
}

/**
 * Schema for notification rule: Object<channelName, channelSchema>
 */
type RuleSchema = Index<ChannelSchema>;

/**
 * Schema for project: Object<ruleId, ruleSchema>
 */
type ProjectSchema = Index<RuleSchema>;

/**
 * Buffer schema: Object<projectId, projectSchema>
 */
type BufferSchema = Index<ProjectSchema>;

/**
 * Composed key to identify channel
 *
 * [projectId, ruleId, channelName]
 */
export type ChannelKey = [string, string, string];

/**
 * Composed key to identify event
 *
 * [projectId, ruleId, channelName, eventGroupHash]
 */
export type EventKey = [string, string, string, string];

/**
 * Channels' buffer to store number of received events
 */
export default class Buffer {
  /**
   * Store
   */
  private projects: BufferSchema = {};

  /**
   * Add event to channel's buffer
   *
   * @param {EventKey} key - key of event to increment
   */
  public push(key: EventKey): void {
    const eventKey = key[3];
    const channel = this.getChannel(key.slice(0, -1) as ChannelKey);

    this.getField(channel.payload, eventKey, 0);

    channel.payload[eventKey]++;
  }

  /**
   * Get channel data
   *
   * @param {ChannelKey} key - key of channel to retrieve
   *
   * @return {BufferData[]}
   */
  public get(key: ChannelKey): BufferData[];

  /**
   * Get event data
   *
   * @param {EventKey} key - key of event to get
   *
   * @return {number} - number of events received for minPeriod
   */
  public get(key: EventKey): number;

  /**
   * Implementation of two methods above
   *
   * @param {ChannelKey|EventKey} arg - Channel or Event key
   *
   * @return {BufferData[]|number}
   */
  public get(arg: ChannelKey | EventKey): BufferData[] | number {
    const [projectId, ruleId, channelName, key] = arg;

    const channel = this.getChannel([projectId, ruleId, channelName]);

    if (key) {
      return channel.payload[key];
    }

    return Object
      .entries(channel.payload)
      .map(([k, count]) => ({key: k, count}));
  }

  /**
   * Return size of channel's buffer
   *
   * @param {ChannelKey} key - key of channel to get size of
   *
   * @return {number}
   */
  public size(key: ChannelKey): number {
    return this.get(key).length;
  }

  /**
   * Set timer for channel
   *
   * @param {ChannelKey} key - key of channel to set timer to
   * @param {number} timeout - timer timeout time in ms
   * @param {function} callback - callback to call on timeot
   */
  public setTimer(key: ChannelKey, timeout: number, callback: (...args: any[]) => void) {
    const channel = this.getChannel(key);

    channel.timer = setTimeout(
      callback,
      timeout,
      key,
    );

    return channel.timer;
  }

  /**
   * Get channel timer
   *
   * @param {ChannelKey} key - key of channel to get timer
   *
   * @return {Timeout}
   */
  public getTimer(key: ChannelKey): Timeout {
    const channel = this.getChannel(key);

    return channel.timer;
  }

  /**
   * Clear channel timer
   *
   * @param {ChannelKey} key - key of channel to clear timer
   */
  public clearTimer(key: ChannelKey): void {
    const channel = this.getChannel(key);

    clearTimeout(channel.timer);

    channel.timer = null;
  }

  /**
   * Flush channel buffer and return it's data
   *
   * @param {ChannelKey} key - key of channel to flush
   *
   * @return BufferData[]
   */
  public flush(key: ChannelKey): BufferData[] {
    const channel = this.getChannel(key);

    const data = this.get(key);

    channel.payload = {};

    return data;
  }

  /**
   * Flush project buffer or whole buffer
   *
   * @param {string} [projectId] - project to flush, if not set whole buffer is flushed
   */
  public flushAll(projectId?: string): void {
    if (projectId) {
      this.projects[projectId] = {};
      return;
    }

    this.projects = {};
  }

  /**
   * Get channel buffer
   *
   * @param {string} projectId - id of project event is related to
   * @param {string} ruleId - id of rule channel is related to
   * @param {string} channelName - telegram, slack, or email
   */
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

  /**
   * Helper method to get object field and set default value if one doesn't exist
   *
   * @param {T = any} obj — any object
   * @param {string} field — field to get
   * @param {V = any} defaultValue - default value to set if field doesn't exist
   *
   * @return {V} — fields value
   */
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
