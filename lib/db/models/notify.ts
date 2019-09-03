import {ObjectID} from 'mongodb';

/**
 * Event action types
 */
export enum eventActions {
  ONLY_NEW = 1,
  ALL = 2,
  INCLUDING = 3,
}

/**
 * Provider settings
 */
export interface ProviderSettings {
  /**
   * Is provider enabled
   */
  enabled: boolean;

  /**
   * Provider value (email, webhook, etc)
   */
  value: string;
}

export interface Notify {
  /**
   * User ID
   */
  userId?: ObjectID | string;

  actionType: eventActions;

  /**
   * words to filter when actionType is INCLUDING
   */
  words: string;

  /**
   * Notify settings
   */
  settings: {
    email: ProviderSettings;
    tg: ProviderSettings;
    slack: ProviderSettings;
  };
}

export const defaultNotify: Notify = {
  actionType: eventActions.ONLY_NEW,
  words: '',
  settings: {
    email: {
      enabled: false,
      value: '',
    },
    tg: {
      enabled: false,
      value: '',
    },
    slack: {
      enabled: false,
      value: '',
    },
  },
};
