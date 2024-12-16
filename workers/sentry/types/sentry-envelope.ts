/**
 * Structures for Sentry envelope
 */
export interface SentryEnvelope {
  Header: SentryHeader;
  Items: SentryItem[];
}

export interface SentryItem {
  Header: Record<string, any>;
  Payload: Record<string, any>;
}

export type SentryHeader = Record<string, any>;