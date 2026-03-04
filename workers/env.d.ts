/**
 * @file Types for process.env
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

    /**
     * How long to store events (in days)
     */
    MAX_DAYS_NUMBER: string;

    /**
     * If true, dual-write to unified events/repetitions collections (events, repetitions with projectId)
     * @default 'false'
     */
    USE_UNIFIED_EVENTS_COLLECTIONS?: string;

    /**
     * Comma-separated project ObjectIds for dual-write. If empty/not set, dual-write disabled
     */
    UNIFIED_EVENTS_PROJECT_IDS?: string;
  }
}
