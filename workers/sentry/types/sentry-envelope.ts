/**
 * Structures for Sentry envelope
 */
export interface SentryEnvelope {
  Header: Record<string, any>;
  Items: SentryItem[];
}

export interface SentryItem {
  Header: Record<string, any>;
  Payload: Record<string, any>;
}