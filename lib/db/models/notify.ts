/**
 * Event action types
 */
export enum eventActions {
  ONLY_NEW = 1,
  ALL = 2,
  INCLUDING = 3
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
  }
}
