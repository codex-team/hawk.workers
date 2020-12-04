/**
 * Function to be called on each iteration
 */
type AsyncForEachCallback<T> = (item: T, index: number, array: T[]) => Promise<void>;

/**
 * Asynchronous forEach function
 *
 * @param array - array to iterate
 * @param callback - callback for processing array items
 */
export default async function asyncForEach<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  array: T[], callback: AsyncForEachCallback<T>
): Promise<void> {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}
