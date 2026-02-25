/**
 * Parsed config for grouper memory monitoring.
 */
export interface GrouperMemoryConfig {
  logEveryTasks: number;
  growthWindowTasks: number;
  growthWarnMb: number;
  handleGrowthWarnMb: number;
}

const DEFAULT_MEMORY_LOG_EVERY_TASKS = 50;
const DEFAULT_MEMORY_GROWTH_WINDOW_TASKS = 200;
const DEFAULT_MEMORY_GROWTH_WARN_MB = 64;
const DEFAULT_MEMORY_HANDLE_GROWTH_WARN_MB = 16;

/**
 * Histogram buckets for payload and delta sizes (bytes).
 */
// eslint-disable-next-line @typescript-eslint/no-magic-numbers
export const GROUPER_METRICS_SIZE_BUCKETS = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000];

/**
 * Parse positive numeric env value.
 *
 * @param value - env string value.
 * @param fallback - default numeric fallback.
 */
function asPositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Memory monitoring config from environment.
 */
export const grouperMemoryConfig: GrouperMemoryConfig = {
  logEveryTasks: asPositiveNumber(process.env.GROUPER_MEMORY_LOG_EVERY_TASKS, DEFAULT_MEMORY_LOG_EVERY_TASKS),
  growthWindowTasks: asPositiveNumber(process.env.GROUPER_MEMORY_GROWTH_WINDOW_TASKS, DEFAULT_MEMORY_GROWTH_WINDOW_TASKS),
  growthWarnMb: asPositiveNumber(process.env.GROUPER_MEMORY_GROWTH_WARN_MB, DEFAULT_MEMORY_GROWTH_WARN_MB),
  handleGrowthWarnMb: asPositiveNumber(process.env.GROUPER_MEMORY_HANDLE_GROWTH_WARN_MB, DEFAULT_MEMORY_HANDLE_GROWTH_WARN_MB),
};
