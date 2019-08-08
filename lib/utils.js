/**
 * Stop execution for a given number of milliseconds
 * @param {number} ms - number of milliseconds to stop execution
 * @returns {Promise<void>}
 */
module.exports.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
