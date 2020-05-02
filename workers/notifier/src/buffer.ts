'use strict';

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
  timer: Timeout | null;
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
   * @param key - key of event to increment
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
   * @param key - key of channel to retrieve
   */
  public get(key: ChannelKey): BufferData[];

  /**
   * Get event data
   *
   * @param key - key of event to get
   *
   * @returns {number} - number of events received for minPeriod
   */
  // eslint-disable-next-line no-dupe-class-members
  public get(key: EventKey): number;

  /**
   * Implementation of two methods above
   *
   * @param arg - Channel or Event key
   */
  // eslint-disable-next-line no-dupe-class-members
  public get(arg: ChannelKey | EventKey): BufferData[] | number {
    const [projectId, ruleId, channelName, key] = arg;

    const channel = this.getChannel([projectId, ruleId, channelName]);

    if (key) {
      return channel.payload[key];
    }

    return Object
      .entries(channel.payload)
      .map(([k, count]) => ({
        key: k,
        count,
      }));
  }

  /**
   * Return size of channel's buffer
   *
   * @param key - key of channel to get size of
   *
   * @returns {number}
   */
  public size(key: ChannelKey): number {
    return this.get(key).length;
  }

  /**
   * Set timer for channel
   *
   * @param key - key of channel to set timer to
   * @param timeout - timer timeout time in ms
   * @param callback - callback to call on timeout
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public setTimer(key: ChannelKey, timeout: number, callback: (...args: any[]) => void): Timeout {
    const channel = this.getChannel(key);

    channel.timer = setTimeout(
      callback,
      timeout,
      key
    );

    return channel.timer;
  }

  /**
   * Get channel timer
   *
   * @param key - key of channel to get timer
   *
   * @returns {Timeout}
   */
  public getTimer(key: ChannelKey): Timeout | null {
    const channel = this.getChannel(key);

    return channel.timer;
  }

  /**
   * Clear channel timer
   *
   * @param key - key of channel to clear timer
   */
  public clearTimer(key: ChannelKey): void {
    const channel = this.getChannel(key);

    if (channel.timer) {
      clearTimeout(channel.timer);
    }

    channel.timer = null;
  }

  /**
   * Flush channel buffer and return it's data
   *
   * @param key - key of channel to flush
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
   * @param {object} params - method rest params
   * @param {string} params.projectId - id of project event is related to
   * @param {string} params.ruleId - id of rule channel is related to
   * @param {string} params.channelName - telegram, slack, or email
   */
  private getChannel([projectId, ruleId, channelName]: ChannelKey): ChannelSchema {
    const project = this.getField<ProjectSchema>(
      this.projects,
      projectId,
      {}
    );
    const rule = this.getField<RuleSchema>(
      project,
      ruleId,
      {}
    );

    return this.getField<ChannelSchema>(
      rule,
      channelName,
      {
        payload: {},
        timer: null,
      }
    );
  }

  /**
   * Helper method to get object field and set default value if one doesn't exist
   *
   * @param obj — any object
   * @param field — field to get
   * @param defaultValue - default value to set if field doesn't exist
   */
  private getField<V>(
    obj: {[key: string]: V},
    field: string,
    defaultValue: V
  ): V {
    if (!(field in obj)) {
      obj[field] = defaultValue;
    }

    return obj[field];
  }
}
