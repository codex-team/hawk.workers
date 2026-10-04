const baseConfig = require('../../jest.config');

module.exports = {
  ...baseConfig,
  rootDir: '../..',
  setupFiles: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/workers/release-validator/jest.setup.js',
  ],
  setupFilesAfterEnv: [ '<rootDir>/jest.setup.mongo-repl-set.js' ],
  globalTeardown: '<rootDir>/jest.global-teardown.js',
  roots: [
    '<rootDir>/workers/release-validator',
    '<rootDir>/lib',
  ],
  testMatch: [ '<rootDir>/workers/release-validator/**/*.test.ts' ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'node'],
};
