import { ObjectID } from 'mongodb';
import {Channel, ChannelType} from './channel';

export enum WhatToReceive {
  All = 'all',
  New = 'new',
}

export type RuleChannels = {
  [T in ChannelType]: Channel;
};

export interface Rule {
  readonly id: ObjectID;
  readonly isEnabled: boolean;
  readonly uidAdded: ObjectID;
  readonly whatToReceive: WhatToReceive;
  readonly including: string[];
  readonly excluding: string[];
  channels: RuleChannels;
}
