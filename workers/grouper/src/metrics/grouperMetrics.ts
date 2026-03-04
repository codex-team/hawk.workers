import { client, register } from '../../../../lib/metrics';
import { GROUPER_METRICS_SIZE_BUCKETS } from './config';

type EventType = 'new' | 'repeated';
type MongoOperation = 'getEvent' | 'saveEvent' | 'saveRepetition' | 'incrementCounter' | 'saveDailyEvents';

/**
 * Reuse already registered metric by name, or create one.
 *
 * @param name - metric name.
 * @param createMetric - metric factory.
 */
function getOrCreateMetric<MetricType>(name: string, createMetric: () => MetricType): MetricType {
  const existing = register.getSingleMetric(name);

  if (existing) {
    return existing as unknown as MetricType;
  }

  return createMetric();
}

/**
 * Grouper-specific Prometheus metrics facade.
 */
export default class GrouperMetrics {
  private readonly eventsTotal = getOrCreateMetric(
    'hawk_grouper_events_total',
    () => new client.Counter({
      name: 'hawk_grouper_events_total',
      help: 'Total number of events processed by grouper',
      labelNames: [ 'type' ],
      registers: [ register ],
    })
  );

  private readonly handleDuration = getOrCreateMetric(
    'hawk_grouper_handle_duration_seconds',
    () => new client.Histogram({
      name: 'hawk_grouper_handle_duration_seconds',
      help: 'Duration of handle() call in seconds',
      registers: [ register ],
    })
  );

  private readonly errorsTotal = getOrCreateMetric(
    'hawk_grouper_errors_total',
    () => new client.Counter({
      name: 'hawk_grouper_errors_total',
      help: 'Total number of errors during event processing',
      registers: [ register ],
    })
  );

  private readonly mongoDuration = getOrCreateMetric(
    'hawk_grouper_mongo_duration_seconds',
    () => new client.Histogram({
      name: 'hawk_grouper_mongo_duration_seconds',
      help: 'Duration of MongoDB operations in seconds',
      labelNames: [ 'operation' ],
      registers: [ register ],
    })
  );

  private readonly deltaSize = getOrCreateMetric(
    'hawk_grouper_delta_size_bytes',
    () => new client.Histogram({
      name: 'hawk_grouper_delta_size_bytes',
      help: 'Size of computed repetition delta in bytes',
      buckets: GROUPER_METRICS_SIZE_BUCKETS,
      registers: [ register ],
    })
  );

  private readonly payloadSize = getOrCreateMetric(
    'hawk_grouper_payload_size_bytes',
    () => new client.Histogram({
      name: 'hawk_grouper_payload_size_bytes',
      help: 'Size of incoming event payload in bytes',
      buckets: GROUPER_METRICS_SIZE_BUCKETS,
      registers: [ register ],
    })
  );

  private readonly duplicateRetriesTotal = getOrCreateMetric(
    'hawk_grouper_duplicate_retries_total',
    () => new client.Counter({
      name: 'hawk_grouper_duplicate_retries_total',
      help: 'Number of retries due to duplicate key errors',
      registers: [ register ],
    })
  );

  /**
   * Measure top-level handle() duration.
   *
   * @param callback - callback to execute under timer.
   */
  public async observeHandleDuration<T>(callback: () => Promise<T>): Promise<T> {
    const endTimer = this.handleDuration.startTimer();

    try {
      return await callback();
    } finally {
      endTimer();
    }
  }

  /**
   * Increment events counter by event type.
   *
   * @param type - event type label.
   */
  public incrementEventsTotal(type: EventType): void {
    this.eventsTotal.inc({ type });
  }

  /**
   * Increment total processing errors counter.
   */
  public incrementErrorsTotal(): void {
    this.errorsTotal.inc();
  }

  /**
   * Observe incoming payload size.
   *
   * @param sizeBytes - payload size in bytes.
   */
  public observePayloadSize(sizeBytes: number): void {
    this.payloadSize.observe(sizeBytes);
  }

  /**
   * Observe computed delta size.
   *
   * @param sizeBytes - delta size in bytes.
   */
  public observeDeltaSize(sizeBytes: number): void {
    this.deltaSize.observe(sizeBytes);
  }

  /**
   * Increment retries caused by duplicate key races.
   */
  public incrementDuplicateRetriesTotal(): void {
    this.duplicateRetriesTotal.inc();
  }

  /**
   * Measure Mongo operation duration.
   *
   * @param operation - mongodb operation label.
   * @param callback - callback to execute under timer.
   */
  public async observeMongoDuration<T>(operation: MongoOperation, callback: () => Promise<T>): Promise<T> {
    const endTimer = this.mongoDuration.startTimer({ operation });

    try {
      return await callback();
    } finally {
      endTimer();
    }
  }
}
