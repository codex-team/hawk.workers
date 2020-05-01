/**
 * Asynchronous forEach function
 *
 * @param array - array to iterate
 * @param callback - callback for processing array items
 */
export default async function asyncForEach(array, callback): Promise<void> {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
};
