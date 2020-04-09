import { ObjectID } from 'mongodb';
import {Channel, ChannelType} from './channel';

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
  [T in ChannelType]: Channel;
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
   * Words event title must not include
   */
  readonly excluding: string[];

  /**
   * Rule channels
   */
  channels: RuleChannels;
}
