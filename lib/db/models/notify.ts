import { ObjectID } from 'mongodb';

/**
 * Event action types
 */
export enum notifyActions {
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

/**
 * Notify model representation
 */
export interface NotifySettings {
  /**
   * User ID
   */
  userId?: ObjectID | string;

  /**
   * Activated action type
   */
  actionType: notifyActions;

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

/**
 * Default notify settings
 */
export const defaultNotify: NotifySettings = {
  actionType: notifyActions.ONLY_NEW,
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
