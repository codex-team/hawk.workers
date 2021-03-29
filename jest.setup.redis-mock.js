/**
 * Mock redis library
 */
jest.mock('redis', () => jest.requireActual('redis-mock'));
