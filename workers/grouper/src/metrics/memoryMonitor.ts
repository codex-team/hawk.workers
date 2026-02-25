import type { GrouperMemoryConfig } from './config';

interface LoggerLike {
  info(message: string): void;
  warn(message: string): void;
}

const ROUND_PRECISION = 100;
// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const BYTES_IN_MEBIBYTE = 1024 * 1024;

/**
 * Handles memory checkpoints and leak-oriented logging for Grouper worker.
 */
export default class GrouperMemoryMonitor {
  private readonly logger: LoggerLike;
  private readonly config: GrouperMemoryConfig;
  private memoryCheckpointTask = 0;
  private memoryCheckpointHeapUsed = 0;

  /**
   * @param logger - logger instance.
   * @param config - memory monitor thresholds.
   */
  constructor(logger: LoggerLike, config: GrouperMemoryConfig) {
    this.logger = logger;
    this.config = config;
  }

  /**
   * Initialize baseline memory state on worker startup.
   *
   * @param handledTasksCount - currently handled tasks count.
   */
  public initialize(handledTasksCount: number): void {
    const startupMemory = process.memoryUsage();

    this.memoryCheckpointTask = 0;
    this.memoryCheckpointHeapUsed = startupMemory.heapUsed;
    this.logCheckpoint('startup', startupMemory, handledTasksCount);
  }

  /**
   * Log shutdown memory checkpoint.
   *
   * @param handledTasksCount - handled tasks count on shutdown.
   */
  public logShutdown(handledTasksCount: number): void {
    this.logCheckpoint('shutdown', process.memoryUsage(), handledTasksCount);
  }

  /**
   * Log memory checkpoint on handle() error.
   *
   * @param handledTasksCount - currently handled tasks count.
   * @param title - event title if available.
   */
  public logHandleError(handledTasksCount: number, title: string | undefined): void {
    const suffix = title ? `title="${title}"` : '';

    this.logCheckpoint('handle-error', process.memoryUsage(), handledTasksCount, suffix);
  }

  /**
   * Periodic memory checkpoint before handling task payload.
   *
   * @param memoryUsage - process memory usage.
   * @param handledTasksCount - currently handled tasks count.
   * @param payloadSizeBytes - task payload size.
   */
  public logBeforeHandle(memoryUsage: NodeJS.MemoryUsage, handledTasksCount: number, payloadSizeBytes: number): void {
    if (handledTasksCount !== 1 && handledTasksCount % this.config.logEveryTasks !== 0) {
      return;
    }

    this.logCheckpoint('before-handle', memoryUsage, handledTasksCount, `payloadSize=${payloadSizeBytes}b`);
  }

  /**
   * Log handle() completion memory details and growth checks.
   *
   * @param memoryBeforeHandle - memory usage before handling.
   * @param handledTasksCount - currently handled tasks count.
   * @param payloadSizeBytes - task payload size.
   * @param title - event title.
   * @param projectId - project id.
   */
  public logHandleCompletion(
    memoryBeforeHandle: NodeJS.MemoryUsage,
    handledTasksCount: number,
    payloadSizeBytes: number,
    title: string,
    projectId: string
  ): void {
    const memoryAfterHandle = process.memoryUsage();
    const heapDeltaBytes = memoryAfterHandle.heapUsed - memoryBeforeHandle.heapUsed;
    const heapDeltaMb = Math.round((heapDeltaBytes / BYTES_IN_MEBIBYTE) * ROUND_PRECISION) / ROUND_PRECISION;

    this.logger.info(
      `[handle] done, ${this.formatMemoryUsage(memoryAfterHandle)} heapDelta=${heapDeltaMb}MB handled=${handledTasksCount}`
    );

    if (heapDeltaBytes > this.config.handleGrowthWarnMb * BYTES_IN_MEBIBYTE) {
      this.logger.warn(
        `[memory] high heap growth in single handle: heapDelta=${heapDeltaMb}MB payloadSize=${payloadSizeBytes}b title="${title}" project=${projectId}`
      );
    }

    this.checkMemoryGrowthWindow(memoryAfterHandle, handledTasksCount);
  }

  /**
   * Logs sustained heap growth over a configurable number of handled tasks.
   *
   * @param memoryUsage - current process memory usage.
   * @param handledTasksCount - currently handled tasks count.
   */
  private checkMemoryGrowthWindow(memoryUsage: NodeJS.MemoryUsage, handledTasksCount: number): void {
    const tasksInWindow = handledTasksCount - this.memoryCheckpointTask;

    if (tasksInWindow < this.config.growthWindowTasks) {
      return;
    }

    const heapGrowthBytes = memoryUsage.heapUsed - this.memoryCheckpointHeapUsed;
    const heapGrowthMb = Math.round((heapGrowthBytes / BYTES_IN_MEBIBYTE) * ROUND_PRECISION) / ROUND_PRECISION;
    const heapUsedNowMb = Math.round((memoryUsage.heapUsed / BYTES_IN_MEBIBYTE) * ROUND_PRECISION) / ROUND_PRECISION;

    this.logger.info(
      `[memory] growth window tasks=${tasksInWindow} handled=${this.memoryCheckpointTask + 1}-${handledTasksCount} heapGrowth=${heapGrowthMb}MB heapUsedNow=${heapUsedNowMb}MB`
    );

    if (heapGrowthBytes > this.config.growthWarnMb * BYTES_IN_MEBIBYTE) {
      this.logger.warn(
        `[memory] possible leak detected: heap grew by ${heapGrowthMb}MB in ${tasksInWindow} handled tasks`
      );
    }

    this.memoryCheckpointTask = handledTasksCount;
    this.memoryCheckpointHeapUsed = memoryUsage.heapUsed;
  }

  /**
   * Format memory usage for consistent logs.
   *
   * @param memoryUsage - current process memory usage.
   */
  private formatMemoryUsage(memoryUsage: NodeJS.MemoryUsage): string {
    const heapUsedMb = Math.round((memoryUsage.heapUsed / BYTES_IN_MEBIBYTE) * ROUND_PRECISION) / ROUND_PRECISION;
    const heapTotalMb = Math.round((memoryUsage.heapTotal / BYTES_IN_MEBIBYTE) * ROUND_PRECISION) / ROUND_PRECISION;
    const rssMb = Math.round((memoryUsage.rss / BYTES_IN_MEBIBYTE) * ROUND_PRECISION) / ROUND_PRECISION;
    const externalMb = Math.round((memoryUsage.external / BYTES_IN_MEBIBYTE) * ROUND_PRECISION) / ROUND_PRECISION;
    const arrayBuffersMb = Math.round((memoryUsage.arrayBuffers / BYTES_IN_MEBIBYTE) * ROUND_PRECISION) / ROUND_PRECISION;

    return `heapUsed=${heapUsedMb}MB heapTotal=${heapTotalMb}MB rss=${rssMb}MB external=${externalMb}MB arrayBuffers=${arrayBuffersMb}MB`;
  }

  /**
   * Writes one memory checkpoint record.
   *
   * @param stage - lifecycle stage.
   * @param memoryUsage - current process memory usage.
   * @param handledTasksCount - currently handled tasks count.
   * @param suffix - optional extra suffix.
   */
  private logCheckpoint(stage: string, memoryUsage: NodeJS.MemoryUsage, handledTasksCount: number, suffix = ''): void {
    const extra = suffix ? ` ${suffix}` : '';

    this.logger.info(`[memory] stage=${stage} handled=${handledTasksCount} ${this.formatMemoryUsage(memoryUsage)}${extra}`);
  }
}
