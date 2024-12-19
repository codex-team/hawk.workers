import SentryEventWorker from '../src';
import '../../../env-test';
import { mockedAmqpChannel } from '../../../jest.setup.js';
import { EventEnvelope, serializeEnvelope, SeverityLevel } from '@sentry/core';
import { b64encode } from '../src/utils/base64';
import { EventWorkerTask } from '../../../lib/types/event-worker-task';
import { SentryEventWorkerTask } from '../types/sentry-event-worker-task';

/**
 * Worker adds a task to the queue with buffered payload
 * So we need to get parse it back to compare
 */
function getAddTaskPayloadFromLastCall(): EventWorkerTask {
  /**
   * Get last rabbit sendToQueue call
   */
  const lastCall = mockedAmqpChannel.sendToQueue.mock.calls[mockedAmqpChannel.sendToQueue.mock.calls.length - 1];
  /**
   * Parse second (from 0) argument — payload
   */
  const addedTaskPayload = JSON.parse(lastCall[1].toString());

  return addedTaskPayload;
}

describe('SentryEventWorker', () => {
  const worker = new SentryEventWorker();

  beforeAll(async () => {
    await worker.start();
  });

  afterAll(async () => {
    await worker.finish();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  describe('handle()', () => {
    it('should process multiple envelope items correctly', async () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      const envelope: EventEnvelope = [
        {
          event_id: '123e4567-e89b-12d3-a456-426614174000',
          sent_at: '2024-01-01T00:00:00.000Z',
          trace: { trace_id: 'test-trace' },
        },
        [
          [
            {
              type: 'event',
              content_type: 'application/json',
            },
            {
              level: 'error',
              message: 'Error 1',
            },
          ],
          [
            {
              type: 'event',
              content_type: 'application/json',
            },
            {
              level: 'warning',
              message: 'Warning 1',
            },
          ],
        ],
      ];
      /* eslint-enable @typescript-eslint/naming-convention */

      await worker.handle({
        payload: {
          envelope: b64encode(serializeEnvelope(envelope) as string),
        },
        projectId: '123',
        catcherType: 'external/sentry',
      });

      expect(mockedAmqpChannel.sendToQueue).toHaveBeenCalledTimes(2);
    });

    it('should handle invalid base64 payload', async () => {
      const invalidPayload = {
        payload: {
          envelope: 'invalid-base64!',
        },
        projectId: '123',
        catcherType: 'external/sentry' as const,
      };

      worker.muteLogger(true);
      await expect(worker.handle(invalidPayload)).rejects.toThrow();
      worker.muteLogger(false);
    });

    it('should handle empty envelope', async () => {
      const emptyEnvelope: EventEnvelope = [
        {
          /* eslint-disable @typescript-eslint/naming-convention */
          event_id: '123e4567-e89b-12d3-a456-426614174000',
          sent_at: '2024-01-01T00:00:00.000Z',
          /* eslint-enable @typescript-eslint/naming-convention */
        },
        [
          /**
           * No items in envelope
           */
        ],
      ];

      await worker.handle({
        payload: {
          envelope: b64encode(serializeEnvelope(emptyEnvelope) as string),
        },
        projectId: '123',
        catcherType: 'external/sentry',
      });

      expect(mockedAmqpChannel.sendToQueue).not.toHaveBeenCalled();
    });
  });

  describe('handleEnvelopeItem()', () => {
    it('should skip non-event type items', async () => {
      const mixedEnvelope = [
        {
          /* eslint-disable @typescript-eslint/naming-convention */
          event_id: '123e4567-e89b-12d3-a456-426614174000',
          sent_at: '2024-01-01T00:00:00.000Z',
          /* eslint-enable @typescript-eslint/naming-convention */
        },
        [
          [ { type: 'transaction' }, { name: 'Test Transaction' } ],
          [ { type: 'attachment' }, { filename: 'test.txt' } ],
          [ { type: 'client_report' }, {
            timestamp: 1718534400,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            discarded_events: [],
          } ],
        ],
      ];

      await worker.handle({
        payload: {
          envelope: b64encode(JSON.stringify(mixedEnvelope)),
        },
        projectId: '123',
        catcherType: 'external/sentry',
      });

      expect(mockedAmqpChannel.sendToQueue).toHaveBeenCalledTimes(0);
    });

    it('should handle transformation errors gracefully', async () => {
      const malformedEventEnvelope: EventEnvelope = [
        {
          /* eslint-disable @typescript-eslint/naming-convention */
          event_id: '123e4567-e89b-12d3-a456-426614174000',
          sent_at: '2024-01-01T00:00:00.000Z',
          /* eslint-enable @typescript-eslint/naming-convention */
        },
        [
          /**
           * Malformed event data
           */
          [ { type: 'event' }, null],
        ],
      ];

      worker.muteLogger(true);
      await expect(worker.handle({
        payload: {
          envelope: b64encode(serializeEnvelope(malformedEventEnvelope) as string),
        },
        projectId: '123',
        catcherType: 'external/sentry',
      })).rejects.toThrow();
      worker.muteLogger(false);
    });
  });

  describe('transformToHawkFormat()', () => {
    it('should support item payload in Uint8Array (when item header has a "length" property)', async () => {
      const eventEnvelope: EventEnvelope = [
        {
          /* eslint-disable @typescript-eslint/naming-convention */
          event_id: '123e4567-e89b-12d3-a456-426614174000',
          sent_at: '2024-01-01T00:00:00.000Z',
          /* eslint-enable @typescript-eslint/naming-convention */
        },
        [
          [
            {
              type: 'event',
              // eslint-disable-next-line @typescript-eslint/naming-convention
              content_type: 'application/json',
              /**
               * If item header has a "length" property, sentry will parse the itemPayload to a Uint8Array
               * https://github.com/getsentry/sentry-javascript/blob/develop/packages/core/src/utils-hoist/envelope.ts#L173
               */
              length: 100,
            },
            { message: 'Test timestamp' },
          ],
        ],
      ];

      await worker.handle({
        payload: {
          envelope: b64encode(serializeEnvelope(eventEnvelope) as string),
        },
        projectId: '123',
        catcherType: 'external/sentry',
      });

      const addedTaskPayload = getAddTaskPayloadFromLastCall();

      expect(addedTaskPayload).toMatchObject({
        payload: expect.objectContaining({
          type: 'error',
        }),
      });
    });

    it('should handle different event levels', async () => {
      const levels: SeverityLevel[] = ['error', 'warning', 'info', 'fatal'];

      for (const level of levels) {
        const eventEnvelope: EventEnvelope = [
          {
            /* eslint-disable @typescript-eslint/naming-convention */
            event_id: '123e4567-e89b-12d3-a456-426614174000',
            sent_at: '2024-01-01T00:00:00.000Z',
            /* eslint-enable @typescript-eslint/naming-convention */
          },
          [
            [ { type: 'event' }, {
              level,
              message: `Test ${level}`,
            } ],
          ],
        ];

        await worker.handle({
          payload: {
            envelope: b64encode(serializeEnvelope(eventEnvelope) as string),
          },
          projectId: '123',
          catcherType: 'external/sentry',
        });

        const addedTaskPayload = getAddTaskPayloadFromLastCall();

        expect(addedTaskPayload).toMatchObject({
          payload: expect.objectContaining({
            type: level,
          }),
        });
      }
    });

    it('should process different timestamp formats', async () => {
      const timestamps = [
        '2024-01-01T00:00:00.000Z',
        '2024-01-01T00:00:00Z',
        '2024-01-01T00:00:00.000+00:00',
      ];

      for (const timestamp of timestamps) {
        const eventEnvelope: EventEnvelope = [
          {
            /* eslint-disable @typescript-eslint/naming-convention */
            event_id: '123e4567-e89b-12d3-a456-426614174000',
            sent_at: timestamp,
            /* eslint-enable @typescript-eslint/naming-convention */
          },
          [
            [ { type: 'event' }, { message: 'Test timestamp' } ],
          ],
        ];

        await worker.handle({
          payload: {
            envelope: b64encode(serializeEnvelope(eventEnvelope) as string),
          },
          projectId: '123',
          catcherType: 'external/sentry',
        });

        const addedTaskPayload = getAddTaskPayloadFromLastCall();

        expect(addedTaskPayload).toMatchObject({
          payload: expect.objectContaining({
            timestamp: 1704067200,
          }),
        });
      }
    });

    it('should extract backtrace from "exception" field if it is present', async () => {
      const eventEnvelope: EventEnvelope = [
        {
          /* eslint-disable @typescript-eslint/naming-convention */
          event_id: '123e4567-e89b-12d3-a456-426614174000',
          sent_at: '2024-01-01T00:00:00.000Z',
          /* eslint-enable @typescript-eslint/naming-convention */
        },
        [
          [ { type: 'event' }, {
            exception: {
              values: [ {
                stacktrace: {
                  frames: [ {
                    filename: 'test.js',
                    lineno: 10,
                  } ],
                },
              } ],
            },
          } ],
        ],
      ];

      await worker.handle({
        payload: {
          envelope: b64encode(serializeEnvelope(eventEnvelope) as string),
        },
        projectId: '123',
        catcherType: 'external/sentry',
      });

      const addedTaskPayload = getAddTaskPayloadFromLastCall();

      expect(addedTaskPayload).toMatchObject({
        payload: expect.objectContaining({
          backtrace: [ {
            file: 'test.js',
            line: 10,
          } ],
        }),
      });
    });

    it('should extract context from "contexts" field if it is present', async () => {
      const eventEnvelope: EventEnvelope = [
        {
          /* eslint-disable @typescript-eslint/naming-convention */
          event_id: '123e4567-e89b-12d3-a456-426614174000',
          sent_at: '2024-01-01T00:00:00.000Z',
          /* eslint-enable @typescript-eslint/naming-convention */
        },
        [
          [ { type: 'event' }, {
            contexts: {
              device: {
                model: 'iPhone',
              },
            },
          } ],
        ],
      ];

      await worker.handle({
        payload: {
          envelope: b64encode(serializeEnvelope(eventEnvelope) as string),
        },
        projectId: '123',
        catcherType: 'external/sentry',
      });

      const addedTaskPayload = getAddTaskPayloadFromLastCall();

      expect(addedTaskPayload).toMatchObject({
        payload: expect.objectContaining({
          context: {
            device: {
              model: 'iPhone',
            },
          },
        }),
      });
    });

    it('should extract user from "user" field if it is present', async () => {
      const eventEnvelope: EventEnvelope = [
        {
          /* eslint-disable @typescript-eslint/naming-convention */
          event_id: '123e4567-e89b-12d3-a456-426614174000',
          sent_at: '2024-01-01T00:00:00.000Z',
          /* eslint-enable @typescript-eslint/naming-convention */
        },
        [
          [ { type: 'event' }, {
            user: {
              id: '123',
              username: 'test',
              email: 'test@test.com',
            },
          } ],
        ],
      ];

      await worker.handle({
        payload: {
          envelope: b64encode(serializeEnvelope(eventEnvelope) as string),
        },
        projectId: '123',
        catcherType: 'external/sentry',
      });

      const addedTaskPayload = getAddTaskPayloadFromLastCall();

      expect(addedTaskPayload).toMatchObject({
        payload: expect.objectContaining({
          user: {
            id: '123',
            name: 'test',
            url: 'test@test.com',
          },
        }),
      });
    });

    it('should extract addons from remaining fields', async () => {
      const eventEnvelope: EventEnvelope = [
        {
          /* eslint-disable @typescript-eslint/naming-convention */
          event_id: '123e4567-e89b-12d3-a456-426614174000',
          sent_at: '2024-01-01T00:00:00.000Z',
          /* eslint-enable @typescript-eslint/naming-convention */
        },
        [
          [ { type: 'event' }, {
            platform: 'javascript',
            environment: 'production',
            request: { url: 'https://test.com' },
          } ],
        ],
      ];

      await worker.handle({
        payload: {
          envelope: b64encode(serializeEnvelope(eventEnvelope) as string),
        },
        projectId: '123',
        catcherType: 'external/sentry',
      });

      const addedTaskPayload = getAddTaskPayloadFromLastCall();

      expect(addedTaskPayload).toMatchObject({
        payload: expect.objectContaining({
          addons: {
            platform: 'javascript',
            environment: 'production',
            request: { url: 'https://test.com' },
          },
        }),
      });
    });

    it('should extract release from "trace" field if it is present', async () => {
      /**
       * Full trace object
       */
      const trace = {
        /* eslint-disable @typescript-eslint/naming-convention */
        trace_id: 'test-trace',
        public_key: 'mocked-public-key',
        release: '1.0.0',
        /* eslint-enable @typescript-eslint/naming-convention */
      };

      const eventEnvelope: EventEnvelope = [
        {
          /* eslint-disable @typescript-eslint/naming-convention */
          event_id: '123e4567-e89b-12d3-a456-426614174000',
          sent_at: '2024-01-01T00:00:00.000Z',
          /* eslint-enable @typescript-eslint/naming-convention */
          trace,
        },
        [
          [ { type: 'event' }, { message: 'Test trace' } ],
        ],
      ];

      await worker.handle({
        payload: {
          envelope: b64encode(serializeEnvelope(eventEnvelope) as string),
        },
        projectId: '123',
        catcherType: 'external/sentry',
      });

      const addedTaskPayload = getAddTaskPayloadFromLastCall();

      expect(addedTaskPayload).toMatchObject({
        payload: expect.objectContaining({
          release: trace.release,
        }),
      });
    });

    it('should extract release from "release" field if it is present', async () => {
      const eventEnvelope: EventEnvelope = [
        {
          /* eslint-disable @typescript-eslint/naming-convention */
          event_id: '123e4567-e89b-12d3-a456-426614174000',
          sent_at: '2024-01-01T00:00:00.000Z',
          /* eslint-enable @typescript-eslint/naming-convention */
        },
        [
          [ { type: 'event' }, { release: '1.0.0' } ],
        ],
      ];

      await worker.handle({
        payload: {
          envelope: b64encode(serializeEnvelope(eventEnvelope) as string),
        },
        projectId: '123',
        catcherType: 'external/sentry',
      });

      const addedTaskPayload = getAddTaskPayloadFromLastCall();

      expect(addedTaskPayload).toMatchObject({
        payload: expect.objectContaining({
          release: '1.0.0',
        }),
      });
    });

    it('should extract release from "release" field if envelope header has "trace.release" as well', async () => {
      const eventEnvelope: EventEnvelope = [
        {
          /* eslint-disable @typescript-eslint/naming-convention */
          event_id: '123e4567-e89b-12d3-a456-426614174000',
          sent_at: '2024-01-01T00:00:00.000Z',
          trace: {
            release: '1.0.0',
          },
          /* eslint-enable @typescript-eslint/naming-convention */
        },
        [
          [ { type: 'event' }, { release: '1.0.1' } ],
        ],
      ];

      await worker.handle({
        payload: {
          envelope: b64encode(serializeEnvelope(eventEnvelope) as string),
        },
        projectId: '123',
        catcherType: 'external/sentry',
      });

      const addedTaskPayload = getAddTaskPayloadFromLastCall();

      expect(addedTaskPayload).toMatchObject({
        payload: expect.objectContaining({
          release: '1.0.1',
        }),
      });
    });
  });
  describe('(real-data tests)', () => {
    it.only('should process real-world python error', async () => {
      const event = {
        projectId: '675c9605b8264d74b5a7dcf3',
        payload: { envelope: 'eyJldmVudF9pZCI6ImE3OWVhYjNmY2ZjMDQ1ZjM5MTUyNzM5NWJmYzhlZGM2Iiwic2VudF9hdCI6IjIwMjQtMTItMThUMTQ6MDA6MTIuODY2NjYwWiIsInRyYWNlIjp7InRyYWNlX2lkIjoiYTAwMDA1NzEwOGFlNDJhMGIxNTRhY2ZmN2U5YTUxMTQiLCJlbnZpcm9ubWVudCI6InByb2R1Y3Rpb24iLCJyZWxlYXNlIjoiMzVjNDJmMmRkZjUyNGJiZGFmZTIyNDM5Yjk4MWRkZmQwZmIzYjVhZCIsInB1YmxpY19rZXkiOiIyMGRlYTRjN2NmZjg0NWZlYmE3YWJmNDlhYzZhOTdlZWFiMTg4NDNhOTczNDRmODZhY2QzNGM3MzAxNDc3YTQxIn19CnsidHlwZSI6ImV2ZW50IiwiY29udGVudF90eXBlIjoiYXBwbGljYXRpb24vanNvbiIsImxlbmd0aCI6MTk5MH0KeyJsZXZlbCI6ImVycm9yIiwiZXhjZXB0aW9uIjp7InZhbHVlcyI6W3sibWVjaGFuaXNtIjp7InR5cGUiOiJleGNlcHRob29rIiwiaGFuZGxlZCI6ZmFsc2V9LCJtb2R1bGUiOm51bGwsInR5cGUiOiJaZXJvRGl2aXNpb25FcnJvciIsInZhbHVlIjoiZGl2aXNpb24gYnkgemVybyIsInN0YWNrdHJhY2UiOnsiZnJhbWVzIjpbeyJmaWxlbmFtZSI6InNlbnRyeS1wcm9kLnB5IiwiYWJzX3BhdGgiOiIvVXNlcnMvbm9zdHIvZGV2L2NvZGV4L2hhd2subW9uby90ZXN0cy9tYW51YWwvc2VudHJ5L3NlbnRyeS1wcm9kLnB5IiwiZnVuY3Rpb24iOiI8bW9kdWxlPiIsIm1vZHVsZSI6Il9fbWFpbl9fIiwibGluZW5vIjoxMSwicHJlX2NvbnRleHQiOlsiIiwic2VudHJ5X3Nkay5pbml0KCIsIiAgICBkc249ZlwiaHR0cHM6Ly97SEFXS19JTlRFR1JBVElPTl9UT0tFTn1Ae0hPU1R9LzBcIiwiLCIgICAgZGVidWc9VHJ1ZSIsIikiXSwiY29udGV4dF9saW5lIjoiZGl2aXNpb25fYnlfemVybyA9IDEgLyAwIiwicG9zdF9jb250ZXh0IjpbInByaW50KFwidGhpc1wiKSIsInByaW50KFwiaXNcIikiLCJwcmludChcIm9rXCIpIiwiIyByYWlzZSBFeGNlcHRpb24oXCJUaGlzIGlzIGEgdGVzdCBleGNlcHRpb25cIikiXSwidmFycyI6eyJfX25hbWVfXyI6IidfX21haW5fXyciLCJfX2RvY19fIjoiTm9uZSIsIl9fcGFja2FnZV9fIjoiTm9uZSIsIl9fbG9hZGVyX18iOiI8X2Zyb3plbl9pbXBvcnRsaWJfZXh0ZXJuYWwuU291cmNlRmlsZUxvYWRlciBvYmplY3QgYXQgMHgxMDI5MzRjYjA+IiwiX19zcGVjX18iOiJOb25lIiwiX19hbm5vdGF0aW9uc19fIjp7fSwiX19idWlsdGluc19fIjoiPG1vZHVsZSAnYnVpbHRpbnMnIChidWlsdC1pbik+IiwiX19maWxlX18iOiInL1VzZXJzL25vc3RyL2Rldi9jb2RleC9oYXdrLm1vbm8vdGVzdHMvbWFudWFsL3NlbnRyeS9zZW50cnktcHJvZC5weSciLCJfX2NhY2hlZF9fIjoiTm9uZSIsInNlbnRyeV9zZGsiOiI8bW9kdWxlICdzZW50cnlfc2RrJyBmcm9tICcvVXNlcnMvbm9zdHIvZGV2L2NvZGV4L2hhd2subW9uby8udmVudi9saWIvcHl0aG9uMy4xMy9zaXRlLXBhY2thZ2VzL3NlbnRyeV9zZGsvX19pbml0X18ucHknPiJ9LCJpbl9hcHAiOnRydWV9XX19XX0sImV2ZW50X2lkIjoiYTc5ZWFiM2ZjZmMwNDVmMzkxNTI3Mzk1YmZjOGVkYzYiLCJ0aW1lc3RhbXAiOiIyMDI0LTEyLTE4VDE0OjAwOjEyLjg2MzY4NFoiLCJjb250ZXh0cyI6eyJ0cmFjZSI6eyJ0cmFjZV9pZCI6ImEwMDAwNTcxMDhhZTQyYTBiMTU0YWNmZjdlOWE1MTE0Iiwic3Bhbl9pZCI6ImFmNzI2MjMwODk4ODJiNjciLCJwYXJlbnRfc3Bhbl9pZCI6bnVsbH0sInJ1bnRpbWUiOnsibmFtZSI6IkNQeXRob24iLCJ2ZXJzaW9uIjoiMy4xMy4xIiwiYnVpbGQiOiIzLjEzLjEgKG1haW4sIERlYyAgMyAyMDI0LCAxNzo1OTo1MikgW0NsYW5nIDE2LjAuMCAoY2xhbmctMTYwMC4wLjI2LjQpXSJ9fSwidHJhbnNhY3Rpb25faW5mbyI6e30sImJyZWFkY3J1bWJzIjp7InZhbHVlcyI6W119LCJleHRyYSI6eyJzeXMuYXJndiI6WyJzZW50cnktcHJvZC5weSJdfSwibW9kdWxlcyI6eyJwaXAiOiIyNC4zLjEiLCJ1cmxsaWIzIjoiMi4yLjMiLCJzZW50cnktc2RrIjoiMi4xOS4wIiwiY2VydGlmaSI6IjIwMjQuOC4zMCJ9LCJyZWxlYXNlIjoiMzVjNDJmMmRkZjUyNGJiZGFmZTIyNDM5Yjk4MWRkZmQwZmIzYjVhZCIsImVudmlyb25tZW50IjoicHJvZHVjdGlvbiIsInNlcnZlcl9uYW1lIjoiTWFjQm9vay1Qcm8tQWxla3NhbmRyLTUubG9jYWwiLCJzZGsiOnsibmFtZSI6InNlbnRyeS5weXRob24iLCJ2ZXJzaW9uIjoiMi4xOS4wIiwicGFja2FnZXMiOlt7Im5hbWUiOiJweXBpOnNlbnRyeS1zZGsiLCJ2ZXJzaW9uIjoiMi4xOS4wIn1dLCJpbnRlZ3JhdGlvbnMiOlsiYXJndiIsImF0ZXhpdCIsImRlZHVwZSIsImV4Y2VwdGhvb2siLCJsb2dnaW5nIiwibW9kdWxlcyIsInN0ZGxpYiIsInRocmVhZGluZyJdfSwicGxhdGZvcm0iOiJweXRob24ifQo=' },
        catcherType: 'external/sentry',
      };

      await worker.handle(event as SentryEventWorkerTask);

      const addedTaskPayload = getAddTaskPayloadFromLastCall();

      expect(addedTaskPayload).toMatchObject({
        /* eslint-disable @typescript-eslint/naming-convention */
        payload: expect.objectContaining({
          release: '35c42f2ddf524bbdafe22439b981ddfd0fb3b5ad',
          timestamp: 1734530412,
          type: 'error',
          title: 'ZeroDivisionError: division by zero',
          backtrace: [
            {
              file: 'sentry-prod.py',
              line: 11,
              function: '<module>',
              arguments: [
                "__name__='__main__'",
                '__doc__=None',
                '__package__=None',
                '__loader__=<_frozen_importlib_external.SourceFileLoader object at 0x102934cb0>',
                '__spec__=None',
                '__annotations__=[object Object]',
                "__builtins__=<module 'builtins' (built-in)>",
                "__file__='/Users/nostr/dev/codex/hawk.mono/tests/manual/sentry/sentry-prod.py'",
                '__cached__=None',
                "sentry_sdk=<module 'sentry_sdk' from '/Users/nostr/dev/codex/hawk.mono/.venv/lib/python3.13/site-packages/sentry_sdk/__init__.py'>",
              ],
              sourceCode: [
                {
                  content: '',
                  line: 6,
                },
                {
                  content: 'sentry_sdk.init(',
                  line: 7,
                },
                {
                  content: '    dsn=f"https://{HAWK_INTEGRATION_TOKEN}@{HOST}/0",',
                  line: 8,
                },
                {
                  content: '    debug=True',
                  line: 9,
                },
                {
                  content: ')',
                  line: 10,
                },
                {
                  content: 'division_by_zero = 1 / 0',
                  line: 11,
                },
                {
                  content: 'print("this")',
                  line: 12,
                },
                {
                  content: 'print("is")',
                  line: 13,
                },
                {
                  content: 'print("ok")',
                  line: 14,
                },
                {
                  content: '# raise Exception("This is a test exception")',
                  line: 15,
                },
              ],
            },
          ],
          context: {
            runtime: {
              build: '3.13.1 (main, Dec  3 2024, 17:59:52) [Clang 16.0.0 (clang-1600.0.26.4)]',
              name: 'CPython',
              version: '3.13.1',
            },
            trace: {
              parent_span_id: null,
              span_id: 'af72623089882b67',
              trace_id: 'a000057108ae42a0b154acff7e9a5114',
            },
          },
          addons: {
            breadcrumbs: {
              values: [],
            },
            environment: 'production',
            platform: 'python',
            extra: {
              'sys.argv': [ 'sentry-prod.py' ],
            },
            level: 'error',
            modules: {
              certifi: '2024.8.30',
              pip: '24.3.1',
              'sentry-sdk': '2.19.0',
              urllib3: '2.2.3',
            },
            release: '35c42f2ddf524bbdafe22439b981ddfd0fb3b5ad',
            server_name: 'MacBook-Pro-Aleksandr-5.local',
            timestamp: '2024-12-18T14:00:12.863684Z',
          },
        }),
        /* eslint-enable @typescript-eslint/naming-convention */
      });
    });
  });
});
