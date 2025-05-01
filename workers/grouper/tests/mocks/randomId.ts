/**
 * Returns random string
 */
export function generateRandomId(): string {
  const FIRST_RANDOM_START = 2;
  const FIRST_RANDOM_END = 15;
  const RADIX = 36;

  return Math.random().toString(RADIX)
    .substring(FIRST_RANDOM_START, FIRST_RANDOM_END) + Math.random().toString(RADIX)
      .substring(FIRST_RANDOM_START, FIRST_RANDOM_END);
}
