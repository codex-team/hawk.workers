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
   * For testing mongodb queries
   */
  preset: '@shelf/jest-mongodb',

  /**
   * TypeScript support
   */
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },

  setupFiles: [ './jest.setup.js' ],

  setupFilesAfterEnv: ['./jest.setup.redis-mock.js', './jest.setup.mongo-repl-set.js'],

  globalTeardown: './jest.global-teardown.js',
};
