/**
 * Parses a positive-integer env var, using `fallback` for missing, non-numeric,
 * zero or negative values
 *
 * @param value - raw env var value
 * @param fallback - default for an invalid value
 */
export function positiveIntEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}
