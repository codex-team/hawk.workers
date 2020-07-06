/**
 * Asynchronous forEach function
 *
 * @param {Array} array - array to iterate
 * @param {Function} callback - callback for processing array items
 */
async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

/**
 * Returns true if collection exists in database
 *
 * @param {import('mongodb').Db} db - database to check
 * @param {string} collectionName - collection name to check
 */
async function isCollectionExists(db, collectionName) {
  return db.listCollections({ name: collectionName }).hasNext();
}

module.exports = {
  asyncForEach,
  isCollectionExists,
};
