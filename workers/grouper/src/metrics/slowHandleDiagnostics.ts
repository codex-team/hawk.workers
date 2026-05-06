import type { GrouperDiagnosticsConfig } from './config';
import type GrouperMetrics from './grouperMetrics';
import type { GrouperStep } from './grouperMetrics';

interface LoggerLike {
  warn(message: string): void;
}

/**
 * Context describing the handled task for slow handle log line.
 */
export interface SlowHandleContext {
  projectId: string;
  title?: string;
  type: 'new' | 'repeated';
  payloadSize: number;
  deltaSize: number;
}

/**
 * Per-handle diagnostics session: owns its own start timestamp and step timings,
 * measures Grouper handle steps and emits a slow handle warning on demand.
 */
export class SlowHandleSession {
  private readonly startedAt: number = Date.now();
  private readonly timings: Map<GrouperStep, number> = new Map();
  private readonly logger: LoggerLike;
  private readonly metrics: GrouperMetrics;
  private readonly config: GrouperDiagnosticsConfig;

  /**
   * @param logger - logger instance.
   * @param metrics - Grouper metrics facade used to record step duration.
   * @param config - slow handle diagnostics thresholds.
   */
  constructor(logger: LoggerLike, metrics: GrouperMetrics, config: GrouperDiagnosticsConfig) {
    this.logger = logger;
    this.metrics = metrics;
    this.config = config;
  }

  /**
   * Measure a Grouper handle step and accumulate its duration in the session.
   *
   * @param step - step name.
   * @param callback - measured callback.
   */
  public async measureStep<T>(step: GrouperStep, callback: () => Promise<T> | T): Promise<T> {
    const stepStartedAt = Date.now();

    try {
      return await this.metrics.observeStepDuration(step, callback);
    } finally {
      const durationMs = Date.now() - stepStartedAt;
      const previousDurationMs = this.timings.get(step) || 0;

      this.timings.set(step, previousDurationMs + durationMs);
    }
  }

  /**
   * Log slow handle breakdown if total session duration exceeds the warn threshold.
   *
   * @param context - handled task context.
   */
  public logIfSlow(context: SlowHandleContext): void {
    const durationMs = Date.now() - this.startedAt;

    if (durationMs < this.config.slowHandleWarnMs) {
      return;
    }

    const steps = Array.from(this.timings.entries())
      .sort((first, second) => second[1] - first[1])
      .map(([step, stepDurationMs]) => `${step}=${stepDurationMs}ms`)
      .join(' ');

    this.logger.warn(
      `[slowHandle] duration=${durationMs}ms project=${context.projectId} type=${context.type} ` +
      `payloadSize=${context.payloadSize}b deltaSize=${context.deltaSize}b title="${context.title}" steps="${steps}"`
    );
  }
}

/**
 * Factory for per-handle slow handle diagnostics sessions.
 */
export default class SlowHandleDiagnostics {
  private readonly logger: LoggerLike;
  private readonly metrics: GrouperMetrics;
  private readonly config: GrouperDiagnosticsConfig;

  /**
   * @param logger - logger instance.
   * @param metrics - Grouper metrics facade used to record step duration.
   * @param config - slow handle diagnostics thresholds.
   */
  constructor(logger: LoggerLike, metrics: GrouperMetrics, config: GrouperDiagnosticsConfig) {
    this.logger = logger;
    this.metrics = metrics;
    this.config = config;
  }

  /**
   * Start a new per-handle diagnostics session.
   */
  public startSession(): SlowHandleSession {
    return new SlowHandleSession(this.logger, this.metrics, this.config);
  }
}
