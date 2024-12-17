/**
 * We don't need mongo for this worker, so it has own setup file
 */

/**
 * To prevent problems related to timezones we set node timezone
 */
process.env.TZ = 'GMT';

/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/en/configuration.html
 */
module.exports = {
  /**
   * The test environment that will be used for testing
   */
  testEnvironment: 'node',

  /**
   * TypeScript support
   */
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },

  setupFiles: [ './../../jest.setup.js' ],
};
