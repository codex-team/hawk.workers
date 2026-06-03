import type { GrouperDiagnosticsConfig } from './config';
import type GrouperMetrics from './grouperMetrics';
import type { GrouperStep } from './grouperMetrics';

const NS_PER_MS = 1_000_000n;

interface LoggerLike {
  warn(message: string): void;
}

/**
 * Frame on the active measurement stack. childTimeNs accumulates the duration
 * of nested measureStep() calls so the parent step records exclusive time.
 */
interface StepFrame {
  step: GrouperStep;
  startedAt: bigint;
  childTimeNs: bigint;
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
  private readonly startedAt: bigint = process.hrtime.bigint();
  private readonly timings: Map<GrouperStep, number> = new Map();
  private readonly stack: StepFrame[] = [];
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
   * Measure a Grouper handle step and accumulate its exclusive duration
   * (time not spent inside nested measureStep calls) in the session.
   *
   * @param step - step name.
   * @param callback - measured callback.
   */
  public async measureStep<T>(step: GrouperStep, callback: () => Promise<T> | T): Promise<T> {
    const frame: StepFrame = {
      step,
      startedAt: process.hrtime.bigint(),
      childTimeNs: 0n,
    };

    this.stack.push(frame);

    try {
      return await this.metrics.observeStepDuration(step, callback);
    } finally {
      const elapsedNs = process.hrtime.bigint() - frame.startedAt;

      this.stack.pop();

      const parent = this.stack[this.stack.length - 1];

      if (parent) {
        parent.childTimeNs += elapsedNs;
      }

      const exclusiveMs = Number((elapsedNs - frame.childTimeNs) / NS_PER_MS);
      const previousMs = this.timings.get(step) || 0;

      this.timings.set(step, previousMs + exclusiveMs);
    }
  }

  /**
   * Log slow handle breakdown if total session duration exceeds the warn threshold.
   *
   * @param context - handled task context.
   */
  public logIfSlow(context: SlowHandleContext): void {
    const durationMs = Number((process.hrtime.bigint() - this.startedAt) / NS_PER_MS);

    if (durationMs < this.config.slowHandleWarnMs) {
      return;
    }

    const steps = Array.from(this.timings.entries())
      .sort((first, second) => second[1] - first[1])
      .map(([step, stepDurationMs]) => `${step}=${stepDurationMs}ms`)
      .join(' ');

    const titleField = context.title !== undefined
      ? ` title=${JSON.stringify(context.title)}`
      : '';

    this.logger.warn(
      `[slowHandle] duration=${durationMs}ms project=${context.projectId} type=${context.type} ` +
      `payloadSize=${context.payloadSize}b deltaSize=${context.deltaSize}b${titleField} steps="${steps}"`
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
