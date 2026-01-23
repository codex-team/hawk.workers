import { Event as SentryEvent } from '@sentry/core';
import { composeTitle, composeBacktrace, composeContext, composeAddons, composeUserData } from '../src/utils/converter';

describe('converter utils', () => {
  describe('composeTitle()', () => {
    it('should compose title from exception type and value', () => {
      const event: SentryEvent = {
        exception: {
          values: [ {
            type: 'Error',
            value: 'Something went wrong',
          } ],
        },
      };

      expect(composeTitle(event)).toBe('Error: Something went wrong');
    });

    it('should handle missing exception data', () => {
      const event: SentryEvent = {};

      expect(composeTitle(event)).toBe('Unknown: ');
    });
  });

  describe('composeBacktrace()', () => {
    it('should compose backtrace with complete frame data', () => {
      const event: SentryEvent = {
        exception: {
          values: [ {
            stacktrace: {
              frames: [ {
                filename: 'test.js',
                lineno: 10,
                colno: 5,
                function: 'testFunction',
                vars: { param1: 'value1' },
                /* eslint-disable @typescript-eslint/naming-convention */
                context_line: 'const x = 1;',
                pre_context: [ '// comment' ],
                post_context: [ 'console.log(x);' ],
                /* eslint-enable @typescript-eslint/naming-convention */
              } ],
            },
          } ],
        },
      };

      const backtrace = composeBacktrace(event);

      expect(backtrace?.[0]).toEqual({
        file: 'test.js',
        line: 10,
        column: 5,
        function: 'testFunction',
        arguments: [ 'param1=value1' ],
        sourceCode: [
          {
            line: 9,
            content: '// comment',
          },
          {
            line: 10,
            content: 'const x = 1;',
          },
          {
            line: 11,
            content: 'console.log(x);',
          },
        ],
      });
    });

    it('should handle missing frame data', () => {
      const event: SentryEvent = {
        exception: {
          values: [ {
            stacktrace: {
              frames: [ {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                instruction_addr: '0x123',
              } ],
            },
          } ],
        },
      };

      const backtrace = composeBacktrace(event);

      expect(backtrace?.[0]).toEqual({
        file: '0x123',
        line: 0,
      });
    });

    it('should handle nested objects in vars using dot notation', () => {
      const event: SentryEvent = {
        exception: {
          values: [ {
            stacktrace: {
              frames: [ {
                filename: 'test.js',
                lineno: 10,
                vars: {
                  params: {
                    foo: 1,
                    bar: 2,
                    second: {
                      glass: 3,
                    },
                  },
                },
              } ],
            },
          } ],
        },
      };

      const backtrace = composeBacktrace(event);

      expect(backtrace?.[0].arguments).toEqual([
        'params.foo=1',
        'params.bar=2',
        'params.second.glass=3',
      ]);
    });

    it('should handle arrays in vars using dot notation with indices', () => {
      const event: SentryEvent = {
        exception: {
          values: [ {
            stacktrace: {
              frames: [ {
                filename: 'test.js',
                lineno: 10,
                vars: {
                  items: ['first', 'second', 'third'],
                },
              } ],
            },
          } ],
        },
      };

      const backtrace = composeBacktrace(event);

      expect(backtrace?.[0].arguments).toEqual([
        'items.0=first',
        'items.1=second',
        'items.2=third',
      ]);
    });

    it('should handle mixed nested objects and arrays in vars', () => {
      const event: SentryEvent = {
        exception: {
          values: [ {
            stacktrace: {
              frames: [ {
                filename: 'test.js',
                lineno: 10,
                vars: {
                  config: {
                    users: [
                      {
                        name: 'Alice',
                        age: 30,
                      },
                      {
                        name: 'Bob',
                        age: 25,
                      },
                    ],
                    settings: {
                      enabled: true,
                    },
                  },
                },
              } ],
            },
          } ],
        },
      };

      const backtrace = composeBacktrace(event);

      expect(backtrace?.[0].arguments).toEqual([
        'config.users.0.name=Alice',
        'config.users.0.age=30',
        'config.users.1.name=Bob',
        'config.users.1.age=25',
        'config.settings.enabled=true',
      ]);
    });

    it('should handle null and undefined values in vars', () => {
      const event: SentryEvent = {
        exception: {
          values: [ {
            stacktrace: {
              frames: [ {
                filename: 'test.js',
                lineno: 10,
                vars: {
                  nullValue: null,
                  undefinedValue: undefined,
                  normalValue: 'test',
                },
              } ],
            },
          } ],
        },
      };

      const backtrace = composeBacktrace(event);

      expect(backtrace?.[0].arguments).toEqual([
        'nullValue=null',
        'undefinedValue=undefined',
        'normalValue=test',
      ]);
    });

    it('should handle empty objects and arrays in vars', () => {
      const event: SentryEvent = {
        exception: {
          values: [ {
            stacktrace: {
              frames: [ {
                filename: 'test.js',
                lineno: 10,
                vars: {
                  emptyObject: {},
                  emptyArray: [],
                  normalValue: 'test',
                },
              } ],
            },
          } ],
        },
      };

      const backtrace = composeBacktrace(event);

      expect(backtrace?.[0].arguments).toEqual([
        'emptyObject={}',
        'emptyArray=[]',
        'normalValue=test',
      ]);
    });

    it('should reverse frames', () => {
      const event: SentryEvent = {
        exception: {
          values: [ {
            stacktrace: {
              frames: [
                {
                  filename: 'test1.js',
                  lineno: 10,
                },
                {
                  filename: 'test2.js',
                  lineno: 123,
                },
              ],
            },
          } ],
        },
      };

      const backtrace = composeBacktrace(event);

      expect(backtrace?.[0]).toEqual({
        file: 'test2.js',
        line: 123,
      });

      expect(backtrace?.[1]).toEqual({
        file: 'test1.js',
        line: 10,
      });
    });
  });

  describe('composeContext()', () => {
    it('should return contexts if available', () => {
      const contexts = { os: { name: 'Linux' } };
      const event: SentryEvent = { contexts };

      expect(composeContext(event)).toEqual(contexts);
    });

    it('should return undefined if no contexts', () => {
      const event: SentryEvent = {};

      expect(composeContext(event)).toBeUndefined();
    });
  });

  describe('composeAddons()', () => {
    it('should include specified fields from event payload', () => {
      const event: SentryEvent = {
        message: 'Test message',
        logentry: {
          message: 'Test log entry',
        },
        timestamp: 1718851200,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        start_timestamp: 1718851200,
        level: 'error',
        platform: 'javascript',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        server_name: 'test-server',
        release: '1.0.0',
        dist: '1.0.0',
        environment: 'production',
        request: { url: 'https://test.com' },
        transaction: 'test-transaction',
        modules: { key: 'value' },
        fingerprint: [ 'test-fingerprint' ],
        exception: {
          values: [ {
            type: 'Error',
            value: 'Something went wrong',
          } ],
        },
        breadcrumbs: [ {
          message: 'Test breadcrumb',
        } ],
        tags: { key: 'value' },
        extra: { key: 'value' },
      };

      const addons = composeAddons(event);

      expect(addons).toEqual({
        message: 'Test message',
        logentry: {
          message: 'Test log entry',
        },
        timestamp: 1718851200,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        start_timestamp: 1718851200,
        level: 'error',
        platform: 'javascript',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        server_name: 'test-server',
        dist: '1.0.0',
        environment: 'production',
        request: { url: 'https://test.com' },
        transaction: 'test-transaction',
        modules: { key: 'value' },
        fingerprint: [ 'test-fingerprint' ],
        tags: { key: 'value' },
        extra: { key: 'value' },
      });
    });

    it('should exclude undefined fields', () => {
      const event: SentryEvent = {
        message: 'Test message',
      };

      const addons = composeAddons(event);

      expect(addons).toEqual({
        message: 'Test message',
      });
    });
  });

  describe('composeUserData()', () => {
    it('should compose user data from event payload', () => {
      const event: SentryEvent = {
        user: {
          id: '123',
          username: 'testuser',
          email: 'test@example.com',
        },
      };

      expect(composeUserData(event)).toEqual({
        id: '123',
        name: 'testuser',
        url: 'test@example.com',
      });
    });

    it('should handle missing user data', () => {
      const event: SentryEvent = {};

      expect(composeUserData(event)).toBeUndefined();
    });

    it('should handle missing user id', () => {
      const event: SentryEvent = {
        user: {
          username: 'testuser',
          email: 'test@example.com',
        },
      };

      expect(composeUserData(event)).toEqual({
        id: 'unknown',
        name: 'testuser',
        url: 'test@example.com',
      });
    });
  });
});
