import { client, register } from '../../../../lib/metrics';
import { GROUPER_METRICS_SIZE_BUCKETS } from './config';

type EventType = 'new' | 'repeated';
type MongoOperation =
  'findDailyUserRepetition' |
  'findFirstEventByPattern' |
  'findUserRepetition' |
  'getEvent' |
  'getProjectPatterns' |
  'incrementCounter' |
  'saveDailyEvents' |
  'saveEvent' |
  'saveRepetition';

export type GrouperStep =
  'affectedUsers' |
  'affectedUsersRedisLocks' |
  'computeDelta' |
  'decodeEvent' |
  'enqueueNotifier' |
  'findSimilarEvent' |
  'getEvent' |
  'hash' |
  'incrementCounter' |
  'payloadSize' |
  'preprocess' |
  'recordProjectMetrics' |
  'saveDailyEvents' |
  'saveNewEvent' |
  'saveRepetition';

// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const GROUPER_HANDLE_DURATION_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 7.5, 10, 15, 30, 60];

// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const GROUPER_STEP_DURATION_BUCKETS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30];

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
      buckets: GROUPER_HANDLE_DURATION_BUCKETS,
      registers: [ register ],
    })
  );

  private readonly stepDuration = getOrCreateMetric(
    'hawk_grouper_step_duration_seconds',
    () => new client.Histogram({
      name: 'hawk_grouper_step_duration_seconds',
      help: 'Duration of Grouper handle step in seconds',
      labelNames: [ 'step' ],
      buckets: GROUPER_STEP_DURATION_BUCKETS,
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
   * Measure a single Grouper handle step duration.
   *
   * @param step - step label.
   * @param callback - callback to execute under timer.
   */
  public async observeStepDuration<T>(step: GrouperStep, callback: () => Promise<T> | T): Promise<T> {
    const endTimer = this.stepDuration.startTimer({ step });

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
