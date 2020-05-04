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
   * For testing mongodb queries
   */
  preset: '@shelf/jest-mongodb',

  /**
   * TypeScript support
   */
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
};
