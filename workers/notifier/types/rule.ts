import { ObjectID } from 'mongodb';
import { Channel, ChannelType } from './channel';

/**
 * WhatToReceive property values
 */
export enum WhatToReceive {
  All = 'ALL',
  New = 'ONLY_NEW',
}

/**
 * Rule channels object
 */
export type RuleChannels = {
  [T in ChannelType]?: Channel;
};

export interface Rule {
  /**
   * Rule identifier
   */
  readonly _id: ObjectID;

  /**
   * Shows if Rule is enabled
   */
  readonly isEnabled: boolean;

  /**
   * Id of user who add the rule
   */
  readonly uidAdded: ObjectID;

  /**
   * Shows which events rule is accept: all or only new
   */
  readonly whatToReceive: WhatToReceive;

  /**
   * Words event title must include
   */
  readonly including: string[];

  /**
   * If this number of events is reached in the eventThresholdPeriod, the rule will be triggered
   */
  readonly threshold: number;

  /**
   * Size of period (in milliseconds) to count events to compare to rule threshold  
   */
  readonly eventThresholdPeriod: number;

  /**
   * Words event title must not include
   */
  readonly excluding: string[];

  /**
   * Rule channels
   */
  channels: RuleChannels;
}
