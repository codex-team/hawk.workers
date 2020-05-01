/**
 * @file Types for process.env
 */

declare namespace NodeJS {
  export interface ProcessEnv {
    /**
     * Database name with events
     */
    EVENTS_DB_NAME: string;

    /**
     * Database name with accounts
     */
    ACCOUNTS_DB_NAME: string;
  }
}
