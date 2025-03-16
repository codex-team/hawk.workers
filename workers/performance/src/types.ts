/**
 * Interface for time span
 */
interface Span {
  id: string;
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  transactionId: string;
}

/**
 * Interface for performance data
 */
interface PerformancePayload {
    id: string;
    name: string;
    timestamp: number;
    duration: number;
    startTime: number;
    endTime: number;
    catcherVersion: string;
    spans: Span[];
    tags: {
        [key: string]: string;
    };
}

/**
 * Main interface for performance record
 */
interface PerformanceRecord {
  projectId: string;
  payload: PerformancePayload;
  catcherType: 'performance';
}

/**
 * Interface for performance database document
 */
interface PerformanceDocument {
  projectId: string;
  transactionId: string;
  timestamp: number;
  duration: number;
  name: string;
  catcherVersion: string;
  tags: Record<string, string>;
}

interface PerformanceSpansDocument extends Span {
  projectId: string;
  transactionId: string;
  timestamp: number;
}

export type {
  Span,
  PerformanceRecord,
  PerformancePayload,
  PerformanceDocument,
  PerformanceSpansDocument
};