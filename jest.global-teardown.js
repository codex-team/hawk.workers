const process = require('process');
const mongoTeardown = require('@shelf/jest-mongodb/teardown');

module.exports = async () => {
  /**
   * Cleanup MongoDB Memory Server
   * @shelf/jest-mongodb should handle this automatically, but we try to ensure cleanup
   */
  await mongoTeardown();

  if (process.env.CI) {
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
};
