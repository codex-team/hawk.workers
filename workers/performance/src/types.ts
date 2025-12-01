/**
 * Interface for aggregated span data
 */
interface AggregatedSpan {
  aggregationId: string;
  name: string;
  minStartTime: number;
  maxEndTime: number;
  p50duration: number;
  p95duration: number;
  maxDuration: number;
  failureRate: number;
}

/**
 * Interface for transaction data
 */
interface Transaction {
  aggregationId: string;
  name: string;
  avgStartTime: number;
  minStartTime: number;
  maxEndTime: number;
  p50duration: number;
  p95duration: number;
  maxDuration: number;
  count: number;
  failureRate: number;
  aggregatedSpans: AggregatedSpan[];
  timestamp: number;
}

/**
 * Interface for performance data
 */
interface PerformancePayload {
  transactions: Transaction[];
  timestamp: number;
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
  name: string;
  transactions: Transaction[];
  aggregatedData?: AggregatedTransaction[];
  createdAt: Date;
}

/**
 * Interface for aggregated transaction data
 */
interface AggregatedTransaction {
  name: string;
  minStartTime: number;
  maxEndTime: number;
  p50duration: number;
  p95duration: number;
  maxDuration: number;
  failureRate: number;
}

interface PerformanceSpansDocument extends AggregatedTransaction {
  projectId: string;
  transactionId: string;
  timestamp: number;
}

export type {
  Transaction,
  AggregatedSpan,
  PerformanceRecord,
  PerformancePayload,
  PerformanceDocument,
  AggregatedTransaction,
  PerformanceSpansDocument
};