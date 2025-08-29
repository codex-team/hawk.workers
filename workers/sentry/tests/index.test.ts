import SentryEventWorker from '../src';
import '../../../env-test';
import { mockedAmqpChannel } from '../../../jest.setup.js';
import { EventEnvelope, serializeEnvelope, SeverityLevel } from '@sentry/core';
import { b64encode, base64toBuffer } from '../src/utils/base64';
import { CatcherMessagePayload, CatcherMessageType } from '@hawk.so/types';
import { SentryEventWorkerTask } from '../types/sentry-event-worker-task';

/**
 * Worker adds a task to the queue with buffered payload
 * So we need to get parse it back to compare
 */
function getAddTaskPayloadFromLastCall(): CatcherMessagePayload<CatcherMessageType> {
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

      jest.spyOn(worker, 'addTask');

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

        expect(worker.addTask).toHaveBeenCalledWith('errors/default', expect.objectContaining({
          catcherType: 'errors/default',
          timestamp: 1704067200,
          projectId: '123',
          payload: {
            addons: {
              sentry: {
                message: 'Test timestamp',
              },
            },
            catcherVersion: '1.0.1',
            title: 'Unknown: ',
            type: 'error',
          },
        }));
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
            sentry: {
              platform: 'javascript',
              environment: 'production',
              request: { url: 'https://test.com' },
            },
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

  describe('SDK validation and release handling', () => {
    beforeEach(() => {
      jest.spyOn(worker, 'addTask');
    });

    it('should route to JavaScript worker when SDK is in sentryJsSDK list and release is present', async () => {
      const eventEnvelope: EventEnvelope = [
        {
          /* eslint-disable @typescript-eslint/naming-convention */
          event_id: '123e4567-e89b-12d3-a456-426614174000',
          sent_at: '2024-01-01T00:00:00.000Z',
          /* eslint-enable @typescript-eslint/naming-convention */
        },
        [
          [
            { type: 'event' },
            {
              sdk: { name: 'browser' },
              release: '1.0.0',
            },
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

      expect(worker.addTask).toHaveBeenCalledWith('errors/javascript', expect.objectContaining({
        catcherType: 'errors/javascript',
        projectId: '123',
        payload: expect.objectContaining({
          release: '1.0.0',
        }),
      }));
    });

    it('should route to Default worker when SDK is not in sentryJsSDK list', async () => {
      const eventEnvelope: EventEnvelope = [
        {
          /* eslint-disable @typescript-eslint/naming-convention */
          event_id: '123e4567-e89b-12d3-a456-426614174000',
          sent_at: '2024-01-01T00:00:00.000Z',
          /* eslint-enable @typescript-eslint/naming-convention */
        },
        [
          [
            { type: 'event' },
            {
              sdk: { name: 'python' },
              release: '1.0.0',
            },
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

      expect(worker.addTask).toHaveBeenCalledWith('errors/default', expect.objectContaining({
        catcherType: 'errors/default',
        projectId: '123',
        payload: expect.objectContaining({
          release: '1.0.0',
        }),
      }));
    });
  });

  describe('(real-data tests)', () => {
    it('should process real-world python error', async () => {
      const event = {
        projectId: '675c9605b8264d74b5a7dcf3',
        payload: { envelope: 'eyJldmVudF9pZCI6ImE3OWVhYjNmY2ZjMDQ1ZjM5MTUyNzM5NWJmYzhlZGM2Iiwic2VudF9hdCI6IjIwMjQtMTItMThUMTQ6MDA6MTIuODY2NjYwWiIsInRyYWNlIjp7InRyYWNlX2lkIjoiYTAwMDA1NzEwOGFlNDJhMGIxNTRhY2ZmN2U5YTUxMTQiLCJlbnZpcm9ubWVudCI6InByb2R1Y3Rpb24iLCJyZWxlYXNlIjoiMzVjNDJmMmRkZjUyNGJiZGFmZTIyNDM5Yjk4MWRkZmQwZmIzYjVhZCIsInB1YmxpY19rZXkiOiIyMGRlYTRjN2NmZjg0NWZlYmE3YWJmNDlhYzZhOTdlZWFiMTg4NDNhOTczNDRmODZhY2QzNGM3MzAxNDc3YTQxIn19CnsidHlwZSI6ImV2ZW50IiwiY29udGVudF90eXBlIjoiYXBwbGljYXRpb24vanNvbiIsImxlbmd0aCI6MTk5MH0KeyJsZXZlbCI6ImVycm9yIiwiZXhjZXB0aW9uIjp7InZhbHVlcyI6W3sibWVjaGFuaXNtIjp7InR5cGUiOiJleGNlcHRob29rIiwiaGFuZGxlZCI6ZmFsc2V9LCJtb2R1bGUiOm51bGwsInR5cGUiOiJaZXJvRGl2aXNpb25FcnJvciIsInZhbHVlIjoiZGl2aXNpb24gYnkgemVybyIsInN0YWNrdHJhY2UiOnsiZnJhbWVzIjpbeyJmaWxlbmFtZSI6InNlbnRyeS1wcm9kLnB5IiwiYWJzX3BhdGgiOiIvVXNlcnMvbm9zdHIvZGV2L2NvZGV4L2hhd2subW9uby90ZXN0cy9tYW51YWwvc2VudHJ5L3NlbnRyeS1wcm9kLnB5IiwiZnVuY3Rpb24iOiI8bW9kdWxlPiIsIm1vZHVsZSI6Il9fbWFpbl9fIiwibGluZW5vIjoxMSwicHJlX2NvbnRleHQiOlsiIiwic2VudHJ5X3Nkay5pbml0KCIsIiAgICBkc249ZlwiaHR0cHM6Ly97SEFXS19JTlRFR1JBVElPTl9UT0tFTn1Ae0hPU1R9LzBcIiwiLCIgICAgZGVidWc9VHJ1ZSIsIikiXSwiY29udGV4dF9saW5lIjoiZGl2aXNpb25fYnlfemVybyA9IDEgLyAwIiwicG9zdF9jb250ZXh0IjpbInByaW50KFwidGhpc1wiKSIsInByaW50KFwiaXNcIikiLCJwcmludChcIm9rXCIpIiwiIyByYWlzZSBFeGNlcHRpb24oXCJUaGlzIGlzIGEgdGVzdCBleGNlcHRpb25cIikiXSwidmFycyI6eyJfX25hbWVfXyI6IidfX21haW5fXyciLCJfX2RvY19fIjoiTm9uZSIsIl9fcGFja2FnZV9fIjoiTm9uZSIsIl9fbG9hZGVyX18iOiI8X2Zyb3plbl9pbXBvcnRsaWJfZXh0ZXJuYWwuU291cmNlRmlsZUxvYWRlciBvYmplY3QgYXQgMHgxMDI5MzRjYjA+IiwiX19zcGVjX18iOiJOb25lIiwiX19hbm5vdGF0aW9uc19fIjp7fSwiX19idWlsdGluc19fIjoiPG1vZHVsZSAnYnVpbHRpbnMnIChidWlsdC1pbik+IiwiX19maWxlX18iOiInL1VzZXJzL25vc3RyL2Rldi9jb2RleC9oYXdrLm1vbm8vdGVzdHMvbWFudWFsL3NlbnRyeS9zZW50cnktcHJvZC5weSciLCJfX2NhY2hlZF9fIjoiTm9uZSIsInNlbnRyeV9zZGsiOiI8bW9kdWxlICdzZW50cnlfc2RrJyBmcm9tICcvVXNlcnMvbm9zdHIvZGV2L2NvZGV4L2hhd2subW9uby8udmVudi9saWIvcHl0aG9uMy4xMy9zaXRlLXBhY2thZ2VzL3NlbnRyeV9zZGsvX19pbml0X18ucHknPiJ9LCJpbl9hcHAiOnRydWV9XX19XX0sImV2ZW50X2lkIjoiYTc5ZWFiM2ZjZmMwNDVmMzkxNTI3Mzk1YmZjOGVkYzYiLCJ0aW1lc3RhbXAiOiIyMDI0LTEyLTE4VDE0OjAwOjEyLjg2MzY4NFoiLCJjb250ZXh0cyI6eyJ0cmFjZSI6eyJ0cmFjZV9pZCI6ImEwMDAwNTcxMDhhZTQyYTBiMTU0YWNmZjdlOWE1MTE0Iiwic3Bhbl9pZCI6ImFmNzI2MjMwODk4ODJiNjciLCJwYXJlbnRfc3Bhbl9pZCI6bnVsbH0sInJ1bnRpbWUiOnsibmFtZSI6IkNQeXRob24iLCJ2ZXJzaW9uIjoiMy4xMy4xIiwiYnVpbGQiOiIzLjEzLjEgKG1haW4sIERlYyAgMyAyMDI0LCAxNzo1OTo1MikgW0NsYW5nIDE2LjAuMCAoY2xhbmctMTYwMC4wLjI2LjQpXSJ9fSwidHJhbnNhY3Rpb25faW5mbyI6e30sImJyZWFkY3J1bWJzIjp7InZhbHVlcyI6W119LCJleHRyYSI6eyJzeXMuYXJndiI6WyJzZW50cnktcHJvZC5weSJdfSwibW9kdWxlcyI6eyJwaXAiOiIyNC4zLjEiLCJ1cmxsaWIzIjoiMi4yLjMiLCJzZW50cnktc2RrIjoiMi4xOS4wIiwiY2VydGlmaSI6IjIwMjQuOC4zMCJ9LCJyZWxlYXNlIjoiMzVjNDJmMmRkZjUyNGJiZGFmZTIyNDM5Yjk4MWRkZmQwZmIzYjVhZCIsImVudmlyb25tZW50IjoicHJvZHVjdGlvbiIsInNlcnZlcl9uYW1lIjoiTWFjQm9vay1Qcm8tQWxla3NhbmRyLTUubG9jYWwiLCJzZGsiOnsibmFtZSI6InNlbnRyeS5weXRob24iLCJ2ZXJzaW9uIjoiMi4xOS4wIiwicGFja2FnZXMiOlt7Im5hbWUiOiJweXBpOnNlbnRyeS1zZGsiLCJ2ZXJzaW9uIjoiMi4xOS4wIn1dLCJpbnRlZ3JhdGlvbnMiOlsiYXJndiIsImF0ZXhpdCIsImRlZHVwZSIsImV4Y2VwdGhvb2siLCJsb2dnaW5nIiwibW9kdWxlcyIsInN0ZGxpYiIsInRocmVhZGluZyJdfSwicGxhdGZvcm0iOiJweXRob24ifQo=' },
        catcherType: 'external/sentry',
      };

      await worker.handle(event as SentryEventWorkerTask);

      const addedTaskPayload = getAddTaskPayloadFromLastCall();

      expect(addedTaskPayload).toMatchObject({
        /* eslint-disable @typescript-eslint/naming-convention */
        timestamp: 1734530412,
        payload: expect.objectContaining({
          release: '35c42f2ddf524bbdafe22439b981ddfd0fb3b5ad',
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
          catcherVersion: '1.0.1',
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
            sentry: {
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
              server_name: 'MacBook-Pro-Aleksandr-5.local',
              timestamp: '2024-12-18T14:00:12.863684Z',
            },
          },
        }),
        /* eslint-enable @typescript-eslint/naming-convention */
      });
    });
  });

  describe('Binary data handling', () => {
    it('should handle envelope with replay_recording binary data without crashing', async () => {
      // This is the actual problematic envelope that was causing crashes
      const problematicEvent = {
        projectId: '621601f4a010d35c68b4625a',
        payload: {
          envelope:
            'eyJldmVudF9pZCI6IjRjNDBmZWU3MzAxOTRhOTg5NDM5YTg2YmY3NTYzNDExIiwic2VudF9hdCI6IjIwMjUtMDgtMjlUMTA6NTk6MjkuOTUyWiIsInNkayI6eyJuYW1lIjoic2VudHJ5LmphdmFzY3JpcHQucmVhY3QiLCJ2ZXJzaW9uIjoiOS4xMC4xIn19CnsidHlwZSI6InJlcGxheV9ldmVudCJ9CnsidHlwZSI6InJlcGxheV9ldmVudCIsInJlcGxheV9zdGFydF90aW1lc3RhbXAiOjE3NTY0NjQ4NjguNDA0LCJ0aW1lc3RhbXAiOjE3NTY0NjUxNjkuOTQ3LCJlcnJvcl9pZHMiOltdLCJ0cmFjZV9pZHMiOlsiZjlkMGE5NjdjZjM2NDFkYzlhODE5NjVjMzY4ZDQ3MzMiXSwidXJscyI6W10sInJlcGxheV9pZCI6IjRjNDBmZWU3MzAxOTRhOTg5NDM5YTg2YmY3NTYzNDExIiwic2VnbWVudF9pZCI6MywicmVwbGF5X3R5cGUiOiJzZXNzaW9uIiwicmVxdWVzdCI6eyJ1cmwiOiJodHRwczovL3ZpZXcueXN0dXR5LnJ1L2dyb3VwIyVEMCU5QyVEMCU5Qy0yMSIsImhlYWRlcnMiOnsiUmVmZXJlciI6Imh0dHBzOi8vYXdheS52ay5jb20vIiwiVXNlci1BZ2VudCI6Ik1vemlsbGEvNS4wIChpUGhvbmU7IENQVSBpUGhvbmUgT1MgMThfNSBsaWtlIE1hYyBPUyBYKSBBcHBsZVdlYktpdC82MDUuMS4xNSAoS0hUTUwsIGxpa2UgR2Vja28pIFZlcnNpb24vMTguNSBNb2JpbGUvMTVFMTQ4IFNhZmFyaS82MDQuMSJ9fSwiZXZlbnRfaWQiOiI0YzQwZmVlNzMwMTk0YTk4OTQzOWE4NmJmNzU2MzQxMSIsImVudmlyb25tZW50IjoicHJvZHVjdGlvbiIsInNkayI6eyJpbnRlZ3JhdGlvbnMiOlsiSW5ib3VuZEZpbHRlcnMiLCJGdW5jdGlvblRvU3RyaW5nIiwiQnJvd3NlckFwaUVycm9ycyIsIkJyZWFkY3J1bWJzIiwiR2xvYmFsSGFuZGxlcnMiLCJMaW5rZWRFcnJvcnMiLCJEZWR1cGUiLCJIdHRwQ29udGV4dCIsIkJyb3dzZXJTZXNzaW9uIiwiQnJvd3NlclRyYWNpbmciLCJSZXBsYXkiXSwibmFtZSI6InNlbnRyeS5qYXZhc2NyaXB0LnJlYWN0IiwidmVyc2lvbiI6IjkuMTAuMSJ9LCJjb250ZXh0cyI6eyJyZWFjdCI6eyJ2ZXJzaW9uIjoiMTcuMC4yIn19LCJ0cmFuc2FjdGlvbiI6Ii9ncm91cCIsInBsYXRmb3JtIjoiamF2YXNjcmlwdCJ9CnsidHlwZSI6InJlcGxheV9yZWNvcmRpbmciLCJsZW5ndGgiOjM0M30KeyJzZWdtZW50X2lkIjozfQp4nJVRwWrCQBD9lzmniQlRMbe2hiJtUTQeikhYkzEJJNnt7mxLKF6JH+UndVIP0tIK3dMy896bN/M2H0CdQoiGDlDVoCHRKIj88XAUjoaDwHeDcOxALkhAxFhRQAQK9V7qRrQZrpRowQElulqKvIdIpoNGI63O0N0jZSUDcjSZrhRVsuV2SaRM5HlFcSNU5XaGLHWutp7xTFZibmv03vzLv9DSKu90PB1vAp/V2KWm5G+72Oa/dQM3HIeXZRqkUrJneIiTsyhZcy9zvkYwGDi8xKtljR5aoshRG/4eHEiZ+CXwLnRbtQWXN7BePqWrx9liEU9he2AUn0DJ1rDYf+kO3M2nL+nidrmK02T2HM/XSa/ZP+dqXv5o4k7C0c+8dprnZ9o2u+9RXRE4D+HY9sLWxLRMEBZSd1y0lburrQa2s/0EaMG6/Q==',
        },
        catcherType: 'external/sentry' as const,
        timestamp: 1756465170,
      };

      // Before the fix, this would throw: SyntaxError: Unexpected token ♦ in JSON at position 0
      // After the fix, it should handle gracefully by filtering out binary data
      await worker.handle(problematicEvent);

      // Should not crash and should not send any tasks (since no event items remain after filtering)
      expect(mockedAmqpChannel.sendToQueue).not.toHaveBeenCalled();
    });

    it('should process mixed envelope with both event and replay_recording items', async () => {
      // Create Sentry envelope format: each line is a separate JSON object
      const envelopeLines = [
        // Envelope header
        JSON.stringify({
          event_id: '4c40fee730194a989439a86bf75634111',
          sent_at: '2025-08-29T10:59:29.952Z',
          sdk: { name: 'sentry.javascript.react', version: '9.10.1' },
        }),
        // Event item header
        JSON.stringify({ type: 'event' }),
        // Event item payload
        JSON.stringify({ message: 'Test event', level: 'error' }),
        // Replay event item header - should be filtered out
        JSON.stringify({ type: 'replay_event' }),
        // Replay event item payload - should be filtered out
        JSON.stringify({ replay_id: 'test-replay', segment_id: 1 }),
        // Replay recording item header - should be filtered out
        JSON.stringify({ type: 'replay_recording', length: 343 }),
        // Replay recording binary payload - should be filtered out
        'binary-data-here-that-is-not-json',
      ];

      const envelopeString = envelopeLines.join('\n');

      await worker.handle({
        payload: {
          envelope: b64encode(envelopeString),
        },
        projectId: '621601f4a010d35c68b4625a',
        catcherType: 'external/sentry',
      });

      // Should only process the event item, not the replay items
      expect(mockedAmqpChannel.sendToQueue).toHaveBeenCalledTimes(1);

      const addedTaskPayload = getAddTaskPayloadFromLastCall();
      expect(addedTaskPayload).toMatchObject({
        payload: expect.objectContaining({
          addons: {
            sentry: {
              message: 'Test event',
              level: 'error',
            },
          },
        }),
      });
    });
  });

  describe('envelope parsing', () => {
    const event = {
      projectId: '67ed371b4196dcbd73537c64',
      payload: {
        envelope: 'eyJldmVudF9pZCI6IjRiNjE0MGZiOTc1MDQ5NDU5MDhmZTUyYzViMGRkMTIzIiwic2RrIjp7Im5hbWUiOiJzZW50cnkuamF2YS5hbmRyb2lkIiwidmVyc2lvbiI6IjguNi4wIiwicGFja2FnZXMiOlt7Im5hbWUiOiJtYXZlbjppby5zZW50cnk6c2VudHJ5IiwidmVyc2lvbiI6IjguNi4wIn0seyJuYW1lIjoibWF2ZW46aW8uc2VudHJ5OnNlbnRyeS1hbmRyb2lkLWNvcmUiLCJ2ZXJzaW9uIjoiOC42LjAifSx7Im5hbWUiOiJtYXZlbjppby5zZW50cnk6c2VudHJ5LWFuZHJvaWQtcmVwbGF5IiwidmVyc2lvbiI6IjguNi4wIn0seyJuYW1lIjoibWF2ZW46aW8uc2VudHJ5OnNlbnRyeS1jb21wb3NlIiwidmVyc2lvbiI6IjguNi4wIn0seyJuYW1lIjoibWF2ZW46aW8uc2VudHJ5OnNlbnRyeS1hbmRyb2lkLW5kayIsInZlcnNpb24iOiI4LjYuMCJ9XSwiaW50ZWdyYXRpb25zIjpbIkFwcFN0YXJ0SW5zdHJ1bWVudGF0aW9uIiwiQ29tcG9zZUluc3RydW1lbnRhdGlvbiIsIkRhdGFiYXNlSW5zdHJ1bWVudGF0aW9uIiwiRmlsZUlPSW5zdHJ1bWVudGF0aW9uIiwiTG9nY2F0SW5zdHJ1bWVudGF0aW9uIiwiVW5jYXVnaHRFeGNlcHRpb25IYW5kbGVyIiwiU2h1dGRvd25Ib29rIiwiU2VuZENhY2hlZEVudmVsb3BlIiwiTmRrIiwiQXBwTGlmZWN5Y2xlIiwiQW5yVjIiLCJBcHBDb21wb25lbnRzQnJlYWRjcnVtYnMiLCJFbnZlbG9wZUZpbGVPYnNlcnZlciIsIlN5c3RlbUV2ZW50c0JyZWFkY3J1bWJzIl19LCJ0cmFjZSI6eyJ0cmFjZV9pZCI6IjM5YjFmYTQ0ZTFkNTQ1MWU5NmFiYTEwNjFhNTY2OTJmIiwicHVibGljX2tleSI6Ijc3ZThjYTBkMzllMzQ5NWZhN2UzNjBkOTYwYjc2ZTVmNzg5Mzc3ZjFmYTJiNGZlMmJmZmI2ODY0OTU5M2ExMjMiLCJyZWxlYXNlIjoiY29tLmV4YW1wbGUubXlhcHBsaWNhdGlvbkAxLjArMSIsImVudmlyb25tZW50IjoicHJvZHVjdGlvbiIsInNhbXBsZV9yYW5kIjoiMC4zNTY0MTc5MDcyOTI0NjMifSwic2VudF9hdCI6IjIwMjUtMDQtMDNUMTM6Mjc6MjcuMzQ4WiJ9CnsiY29udGVudF90eXBlIjoiYXBwbGljYXRpb24vanNvbiIsInR5cGUiOiJldmVudCIsImxlbmd0aCI6ODQwM30KeyJ0aW1lc3RhbXAiOiIyMDI1LTA0LTAzVDEzOjE2OjM4LjQzMFoiLCJleGNlcHRpb24iOnsidmFsdWVzIjpbeyJ0eXBlIjoiRXhjZXB0aW9uIiwidmFsdWUiOiLQotC10YHRgtC+0LLQsNGPINC+0YjQuNCx0LrQsCAjMjg3IiwibW9kdWxlIjoiamF2YS5sYW5nIiwidGhyZWFkX2lkIjoyLCJzdGFja3RyYWNlIjp7ImZyYW1lcyI6W3siZmlsZW5hbWUiOiJaeWdvdGVJbml0LmphdmEiLCJmdW5jdGlvbiI6Im1haW4iLCJtb2R1bGUiOiJjb20uYW5kcm9pZC5pbnRlcm5hbC5vcy5aeWdvdGVJbml0IiwibGluZW5vIjo5MzIsIm5hdGl2ZSI6ZmFsc2V9LHsiZmlsZW5hbWUiOiJSdW50aW1lSW5pdC5qYXZhIiwiZnVuY3Rpb24iOiJydW4iLCJtb2R1bGUiOiJjb20uYW5kcm9pZC5pbnRlcm5hbC5vcy5SdW50aW1lSW5pdCRNZXRob2RBbmRBcmdzQ2FsbGVyIiwibGluZW5vIjo1OTMsIm5hdGl2ZSI6ZmFsc2V9LHsiZmlsZW5hbWUiOiJNZXRob2QuamF2YSIsImZ1bmN0aW9uIjoiaW52b2tlIiwibW9kdWxlIjoiamF2YS5sYW5nLnJlZmxlY3QuTWV0aG9kIiwibmF0aXZlIjp0cnVlfSx7ImZpbGVuYW1lIjoiQWN0aXZpdHlUaHJlYWQuamF2YSIsImZ1bmN0aW9uIjoibWFpbiIsIm1vZHVsZSI6ImFuZHJvaWQuYXBwLkFjdGl2aXR5VGhyZWFkIiwibGluZW5vIjo4OTgyLCJuYXRpdmUiOmZhbHNlfSx7ImZpbGVuYW1lIjoiTG9vcGVyLmphdmEiLCJmdW5jdGlvbiI6Imxvb3AiLCJtb2R1bGUiOiJhbmRyb2lkLm9zLkxvb3BlciIsImxpbmVubyI6MzM4LCJuYXRpdmUiOmZhbHNlfSx7ImZpbGVuYW1lIjoiTG9vcGVyLmphdmEiLCJmdW5jdGlvbiI6Imxvb3BPbmNlIiwibW9kdWxlIjoiYW5kcm9pZC5vcy5Mb29wZXIiLCJsaW5lbm8iOjI0OCwibmF0aXZlIjpmYWxzZX0seyJmaWxlbmFtZSI6IkhhbmRsZXIuamF2YSIsImZ1bmN0aW9uIjoiZGlzcGF0Y2hNZXNzYWdlIiwibW9kdWxlIjoiYW5kcm9pZC5vcy5IYW5kbGVyIiwibGluZW5vIjoxMDMsIm5hdGl2ZSI6ZmFsc2V9LHsiZmlsZW5hbWUiOiJIYW5kbGVyLmphdmEiLCJmdW5jdGlvbiI6ImhhbmRsZUNhbGxiYWNrIiwibW9kdWxlIjoiYW5kcm9pZC5vcy5IYW5kbGVyIiwibGluZW5vIjo5OTUsIm5hdGl2ZSI6ZmFsc2V9LHsiZmlsZW5hbWUiOiJSdW5uYWJsZS5rdCIsImZ1bmN0aW9uIjoicnVuIiwibW9kdWxlIjoia290bGlueC5jb3JvdXRpbmVzLmFuZHJvaWQuSGFuZGxlckNvbnRleHQkc2NoZWR1bGVSZXN1bWVBZnRlckRlbGF5JCRpbmxpbmVkJFJ1bm5hYmxlJDEiLCJsaW5lbm8iOjE5LCJuYXRpdmUiOmZhbHNlfSx7ImZpbGVuYW1lIjoiQ2FuY2VsbGFibGVDb250aW51YXRpb25JbXBsLmt0IiwiZnVuY3Rpb24iOiJyZXN1bWVVbmRpc3BhdGNoZWQiLCJtb2R1bGUiOiJrb3RsaW54LmNvcm91dGluZXMuQ2FuY2VsbGFibGVDb250aW51YXRpb25JbXBsIiwibGluZW5vIjo1OTUsIm5hdGl2ZSI6ZmFsc2V9LHsiZmlsZW5hbWUiOiJDYW5jZWxsYWJsZUNvbnRpbnVhdGlvbkltcGwua3QiLCJmdW5jdGlvbiI6InJlc3VtZUltcGwkZGVmYXVsdCIsIm1vZHVsZSI6ImtvdGxpbnguY29yb3V0aW5lcy5DYW5jZWxsYWJsZUNvbnRpbnVhdGlvbkltcGwiLCJsaW5lbm8iOjQ5NywibmF0aXZlIjpmYWxzZX0seyJmaWxlbmFtZSI6IkNhbmNlbGxhYmxlQ29udGludWF0aW9uSW1wbC5rdCIsImZ1bmN0aW9uIjoicmVzdW1lSW1wbCIsIm1vZHVsZSI6ImtvdGxpbnguY29yb3V0aW5lcy5DYW5jZWxsYWJsZUNvbnRpbnVhdGlvbkltcGwiLCJsaW5lbm8iOjUwOCwibmF0aXZlIjpmYWxzZX0seyJmaWxlbmFtZSI6IkNhbmNlbGxhYmxlQ29udGludWF0aW9uSW1wbC5rdCIsImZ1bmN0aW9uIjoiZGlzcGF0Y2hSZXN1bWUiLCJtb2R1bGUiOiJrb3RsaW54LmNvcm91dGluZXMuQ2FuY2VsbGFibGVDb250aW51YXRpb25JbXBsIiwibGluZW5vIjo0NzQsIm5hdGl2ZSI6ZmFsc2V9LHsiZmlsZW5hbWUiOiJEaXNwYXRjaGVkVGFzay5rdCIsImZ1bmN0aW9uIjoiZGlzcGF0Y2giLCJtb2R1bGUiOiJrb3RsaW54LmNvcm91dGluZXMuRGlzcGF0Y2hlZFRhc2tLdCIsImxpbmVubyI6MTY4LCJuYXRpdmUiOmZhbHNlfSx7ImZpbGVuYW1lIjoiRGlzcGF0Y2hlZFRhc2sua3QiLCJmdW5jdGlvbiI6InJlc3VtZSIsIm1vZHVsZSI6ImtvdGxpbnguY29yb3V0aW5lcy5EaXNwYXRjaGVkVGFza0t0IiwibGluZW5vIjoyMzUsIm5hdGl2ZSI6ZmFsc2V9LHsiZmlsZW5hbWUiOiJDb250aW51YXRpb25JbXBsLmt0IiwiZnVuY3Rpb24iOiJyZXN1bWVXaXRoIiwibW9kdWxlIjoia290bGluLmNvcm91dGluZXMuanZtLmludGVybmFsLkJhc2VDb250aW51YXRpb25JbXBsIiwibGluZW5vIjozMywibmF0aXZlIjpmYWxzZX0seyJmaWxlbmFtZSI6Ik1haW5BY3Rpdml0eS5rdCIsImZ1bmN0aW9uIjoiaW52b2tlU3VzcGVuZCIsIm1vZHVsZSI6ImNvbS5leGFtcGxlLm15YXBwbGljYXRpb24uTWFpbkFjdGl2aXR5JG9uQ3JlYXRlJDIiLCJsaW5lbm8iOjM4LCJpbl9hcHAiOnRydWUsIm5hdGl2ZSI6ZmFsc2V9XX0sIm1lY2hhbmlzbSI6eyJ0eXBlIjoiY2hhaW5lZCIsImV4Y2VwdGlvbl9pZCI6MH19XX0sImZpbmdlcnByaW50IjpbXSwibW9kdWxlcyI6eyJhbmRyb2lkeC5hcmNoLmNvcmU6Y29yZS1ydW50aW1lIjoiMi4yLjAiLCJhbmRyb2lkeC5jb3JlOmNvcmUta3R4IjoiMS4xMy4xIiwib3JnLmpldGJyYWlucy5rb3RsaW46a290bGluLXN0ZGxpYi1qZGs3IjoiMS45LjI0Iiwib3JnLmpldGJyYWlucy5rb3RsaW46a290bGluLXN0ZGxpYi1qZGs4IjoiMS45LjI0IiwiYW5kcm9pZHguY29uY3VycmVudDpjb25jdXJyZW50LWZ1dHVyZXMiOiIxLjEuMCIsImFuZHJvaWR4LmNvbXBvc2UudWk6dWktYW5kcm9pZCI6IjEuNy4wIiwiYW5kcm9pZHgubGlmZWN5Y2xlOmxpZmVjeWNsZS1ydW50aW1lLWFuZHJvaWQiOiIyLjguMyIsImFuZHJvaWR4LmNvbXBvc2UudWk6dWktdXRpbC1hbmRyb2lkIjoiMS43LjAiLCJhbmRyb2lkeC5jb21wb3NlLnVpOnVpLXRvb2xpbmctYW5kcm9pZCI6IjEuNy4wIiwiYW5kcm9pZHguY29tcG9zZS51aTp1aS10b29saW5nLWRhdGEtYW5kcm9pZCI6IjEuNy4wIiwiYW5kcm9pZHguc3RhcnR1cDpzdGFydHVwLXJ1bnRpbWUiOiIxLjEuMSIsImFuZHJvaWR4LmxpZmVjeWNsZTpsaWZlY3ljbGUtdmlld21vZGVsLWFuZHJvaWQiOiIyLjguMyIsImFuZHJvaWR4LmxpZmVjeWNsZTpsaWZlY3ljbGUtdmlld21vZGVsLWt0eCI6IjIuOC4zIiwib3JnLmpldGJyYWlucy5rb3RsaW46a290bGluLXN0ZGxpYiI6IjIuMC4yMSIsImFuZHJvaWR4LmNvbXBvc2UudWk6dWktdGV4dC1hbmRyb2lkIjoiMS43LjAiLCJjb20uZ29vZ2xlLmd1YXZhOmxpc3RlbmFibGVmdXR1cmUiOiIxLjAiLCJhbmRyb2lkeC5saWZlY3ljbGU6bGlmZWN5Y2xlLXByb2Nlc3MiOiIyLjguMyIsImlvLnNlbnRyeTpzZW50cnktY29tcG9zZS1hbmRyb2lkIjoiOC42LjAiLCJhbmRyb2lkeC5hY3Rpdml0eTphY3Rpdml0eS1jb21wb3NlIjoiMS44LjIiLCJhbmRyb2lkeC5jb21wb3NlLnVpOnVpLWdlb21ldHJ5LWFuZHJvaWQiOiIxLjcuMCIsImlvLnNlbnRyeTpzZW50cnktYW5kcm9pZC1yZXBsYXkiOiI4LjYuMCIsImFuZHJvaWR4LmNvbXBvc2UuYW5pbWF0aW9uOmFuaW1hdGlvbi1hbmRyb2lkIjoiMS43LjAiLCJhbmRyb2lkeC5jb21wb3NlLmZvdW5kYXRpb246Zm91bmRhdGlvbi1hbmRyb2lkIjoiMS43LjAiLCJpby5zZW50cnk6c2VudHJ5LW5hdGl2ZS1uZGsiOiIwLjguMyIsImFuZHJvaWR4LmFjdGl2aXR5OmFjdGl2aXR5LWt0eCI6IjEuOC4yIiwiYW5kcm9pZHgubGlmZWN5Y2xlOmxpZmVjeWNsZS1ydW50aW1lLWNvbXBvc2UtYW5kcm9pZCI6IjIuOC4zIiwib3JnLmpldGJyYWlucy5rb3RsaW54OmtvdGxpbngtY29yb3V0aW5lcy1jb3JlLWp2bSI6IjEuNy4zIiwiaW8uc2VudHJ5OnNlbnRyeS1hbmRyb2lkLWNvcmUiOiI4LjYuMCIsImFuZHJvaWR4LmNvbXBvc2UudWk6dWktZ3JhcGhpY3MtYW5kcm9pZCI6IjEuNy4wIiwiYW5kcm9pZHguYWN0aXZpdHk6YWN0aXZpdHkiOiIxLjguMiIsImFuZHJvaWR4LmNvbXBvc2UucnVudGltZTpydW50aW1lLWFuZHJvaWQiOiIxLjcuMCIsImFuZHJvaWR4LmNvbXBvc2UudWk6dWktdGVzdC1tYW5pZmVzdCI6IjEuNy4wIiwiYW5kcm9pZHguZW1vamkyOmVtb2ppMiI6IjEuMy4wIiwiYW5kcm9pZHgubGlmZWN5Y2xlOmxpZmVjeWNsZS12aWV3bW9kZWwtc2F2ZWRzdGF0ZSI6IjIuOC4zIiwiYW5kcm9pZHguZ3JhcGhpY3M6Z3JhcGhpY3MtcGF0aCI6IjEuMC4xIiwiYW5kcm9pZHguY29tcG9zZS5tYXRlcmlhbDM6bWF0ZXJpYWwzLWFuZHJvaWQiOiIxLjMuMCIsImFuZHJvaWR4LmFubm90YXRpb246YW5ub3RhdGlvbi1leHBlcmltZW50YWwiOiIxLjQuMCIsImFuZHJvaWR4LnNhdmVkc3RhdGU6c2F2ZWRzdGF0ZS1rdHgiOiIxLjIuMSIsImFuZHJvaWR4LmNvbGxlY3Rpb246Y29sbGVjdGlvbi1qdm0iOiIxLjQuMCIsImlvLnNlbnRyeTpzZW50cnkta290bGluLWV4dGVuc2lvbnMiOiI4LjYuMCIsIm9yZy5qZXRicmFpbnMua290bGlueDprb3RsaW54LWNvcm91dGluZXMtYW5kcm9pZCI6IjEuNy4zIiwiYW5kcm9pZHguY29tcG9zZS5ydW50aW1lOnJ1bnRpbWUtc2F2ZWFibGUtYW5kcm9pZCI6IjEuNy4wIiwiYW5kcm9pZHguY29tcG9zZS5tYXRlcmlhbDptYXRlcmlhbC1hbmRyb2lkIjoiMS43LjAiLCJhbmRyb2lkeC5zYXZlZHN0YXRlOnNhdmVkc3RhdGUiOiIxLjIuMSIsImFuZHJvaWR4LmNvbXBvc2UudWk6dWktdW5pdC1hbmRyb2lkIjoiMS43LjAiLCJhbmRyb2lkeC5jb3JlOmNvcmUiOiIxLjEzLjEiLCJhbmRyb2lkeC5jb2xsZWN0aW9uOmNvbGxlY3Rpb24ta3R4IjoiMS40LjAiLCJhbmRyb2lkeC5jb21wb3NlLm1hdGVyaWFsOm1hdGVyaWFsLWljb25zLWNvcmUtYW5kcm9pZCI6IjEuNy4wIiwiaW8uc2VudHJ5OnNlbnRyeS1hbmRyb2lkIjoiOC42LjAiLCJhbmRyb2lkeC5saWZlY3ljbGU6bGlmZWN5Y2xlLXJ1bnRpbWUta3R4LWFuZHJvaWQiOiIyLjguMyIsImlvLnNlbnRyeTpzZW50cnktYW5kcm9pZC1uZGsiOiI4LjYuMCIsImFuZHJvaWR4LmFyY2guY29yZTpjb3JlLWNvbW1vbiI6IjIuMi4wIiwiYW5kcm9pZHguY29tcG9zZS5hbmltYXRpb246YW5pbWF0aW9uLWNvcmUtYW5kcm9pZCI6IjEuNy4wIiwiYW5kcm9pZHgubGlmZWN5Y2xlOmxpZmVjeWNsZS1jb21tb24tamF2YTgiOiIyLjguMyIsImFuZHJvaWR4LmN1c3RvbXZpZXc6Y3VzdG9tdmlldy1wb29saW5nY29udGFpbmVyIjoiMS4wLjAiLCJvcmcuamV0YnJhaW5zOmFubm90YXRpb25zIjoiMjMuMC4wIiwiYW5kcm9pZHgubGlmZWN5Y2xlOmxpZmVjeWNsZS1jb21tb24tanZtIjoiMi44LjMiLCJpby5zZW50cnk6c2VudHJ5LWFuZHJvaWQtbmF2aWdhdGlvbiI6IjguNi4wIiwiYW5kcm9pZHguY29tcG9zZS5tYXRlcmlhbDptYXRlcmlhbC1yaXBwbGUtYW5kcm9pZCI6IjEuNy4wIiwiYW5kcm9pZHgubGlmZWN5Y2xlOmxpZmVjeWNsZS1saXZlZGF0YS1jb3JlIjoiMi44LjMiLCJpby5zZW50cnk6c2VudHJ5IjoiOC42LjAiLCJhbmRyb2lkeC5wcm9maWxlaW5zdGFsbGVyOnByb2ZpbGVpbnN0YWxsZXIiOiIxLjMuMSIsImFuZHJvaWR4LmF1dG9maWxsOmF1dG9maWxsIjoiMS4wLjAiLCJhbmRyb2lkeC5pbnRlcnBvbGF0b3I6aW50ZXJwb2xhdG9yIjoiMS4wLjAiLCJhbmRyb2lkeC50cmFjaW5nOnRyYWNpbmciOiIxLjAuMCIsImFuZHJvaWR4LmFubm90YXRpb246YW5ub3RhdGlvbi1qdm0iOiIxLjguMCIsImFuZHJvaWR4LnZlcnNpb25lZHBhcmNlbGFibGU6dmVyc2lvbmVkcGFyY2VsYWJsZSI6IjEuMS4xIiwiYW5kcm9pZHguY29tcG9zZS5mb3VuZGF0aW9uOmZvdW5kYXRpb24tbGF5b3V0LWFuZHJvaWQiOiIxLjcuMCIsImFuZHJvaWR4LmNvbXBvc2UudWk6dWktdG9vbGluZy1wcmV2aWV3LWFuZHJvaWQiOiIxLjcuMCJ9LCJldmVudF9pZCI6IjRiNjE0MGZiOTc1MDQ5NDU5MDhmZTUyYzViMGRkMTIzIiwiY29udGV4dHMiOnsiYXBwIjp7ImFwcF9pZGVudGlmaWVyIjoiY29tLmV4YW1wbGUubXlhcHBsaWNhdGlvbiIsImFwcF9uYW1lIjoiTXkgQXBwbGljYXRpb24iLCJhcHBfdmVyc2lvbiI6IjEuMCIsImFwcF9idWlsZCI6IjEiLCJwZXJtaXNzaW9ucyI6eyJEWU5BTUlDX1JFQ0VJVkVSX05PVF9FWFBPUlRFRF9QRVJNSVNTSU9OIjoiZ3JhbnRlZCIsIklOVEVSTkVUIjoiZ3JhbnRlZCJ9LCJpbl9mb3JlZ3JvdW5kIjp0cnVlLCJpc19zcGxpdF9hcGtzIjpmYWxzZX0sImRldmljZSI6eyJtYW51ZmFjdHVyZXIiOiJHb29nbGUiLCJicmFuZCI6Imdvb2dsZSIsImZhbWlseSI6InNka19ncGhvbmU2NF94ODZfNjQiLCJtb2RlbCI6InNka19ncGhvbmU2NF94ODZfNjQiLCJtb2RlbF9pZCI6IkJQMjIuMjUwMjIxLjAxMCIsImFyY2hzIjpbIng4Nl82NCIsImFybTY0LXY4YSJdLCJiYXR0ZXJ5X2xldmVsIjoxMDAuMCwiY2hhcmdpbmciOmZhbHNlLCJvcmllbnRhdGlvbiI6InBvcnRyYWl0Iiwic2ltdWxhdG9yIjp0cnVlLCJtZW1vcnlfc2l6ZSI6MjA2NzI1NTI5NiwiZnJlZV9tZW1vcnkiOjY1MDUxODUyOCwibG93X21lbW9yeSI6ZmFsc2UsInN0b3JhZ2Vfc2l6ZSI6NjIyODExNTQ1NiwiZnJlZV9zdG9yYWdlIjo0NDcyMzczMjQ4LCJleHRlcm5hbF9zdG9yYWdlX3NpemUiOjUzNDc2MTQ3MiwiZXh0ZXJuYWxfZnJlZV9zdG9yYWdlIjo1MzQ3MDQxMjgsInNjcmVlbl93aWR0aF9waXhlbHMiOjcyMCwic2NyZWVuX2hlaWdodF9waXhlbHMiOjEyODAsInNjcmVlbl9kZW5zaXR5IjoyLjAsInNjcmVlbl9kcGkiOjMyMCwiYm9vdF90aW1lIjoiMjAyNS0wNC0wM1QxMjo0NjozMC45NjhaIiwidGltZXpvbmUiOiJHTVQiLCJpZCI6IjYxZmY0NDk4MGQ5NTQxOTViMDhjMmVlZDgxZTE5MTA0IiwiYmF0dGVyeV90ZW1wZXJhdHVyZSI6MjUuMCwibG9jYWxlIjoiZW5fVVMiLCJwcm9jZXNzb3JfY291bnQiOjQsInByb2Nlc3Nvcl9mcmVxdWVuY3kiOjAuMH0sIm9zIjp7Im5hbWUiOiJBbmRyb2lkIiwidmVyc2lvbiI6IjE2IiwiYnVpbGQiOiJCUDIyLjI1MDIyMS4wMTAiLCJrZXJuZWxfdmVyc2lvbiI6IjYuNi42Ni1hbmRyb2lkMTUtOC1nODA3Y2UzYjRmMDJmLWFiMTI5OTY5MDgiLCJyb290ZWQiOmZhbHNlfSwidHJhY2UiOnsidHJhY2VfaWQiOiIzOWIxZmE0NGUxZDU0NTFlOTZhYmExMDYxYTU2NjkyZiIsInNwYW5faWQiOiJkYzhkZmI2NDI1OWQ0YzEzIiwib3AiOiJkZWZhdWx0Iiwib3JpZ2luIjoibWFudWFsIiwiZGF0YSI6eyJ0aHJlYWQubmFtZSI6Im1haW4iLCJ0aHJlYWQuaWQiOiI5NTM2In19fSwic2RrIjp7Im5hbWUiOiJzZW50cnkuamF2YS5hbmRyb2lkIiwidmVyc2lvbiI6IjguNi4wIiwicGFja2FnZXMiOlt7Im5hbWUiOiJtYXZlbjppby5zZW50cnk6c2VudHJ5IiwidmVyc2lvbiI6IjguNi4wIn0seyJuYW1lIjoibWF2ZW46aW8uc2VudHJ5OnNlbnRyeS1hbmRyb2lkLWNvcmUiLCJ2ZXJzaW9uIjoiOC42LjAifSx7Im5hbWUiOiJtYXZlbjppby5zZW50cnk6c2VudHJ5LWFuZHJvaWQtcmVwbGF5IiwidmVyc2lvbiI6IjguNi4wIn0seyJuYW1lIjoibWF2ZW46aW8uc2VudHJ5OnNlbnRyeS1jb21wb3NlIiwidmVyc2lvbiI6IjguNi4wIn0seyJuYW1lIjoibWF2ZW46aW8uc2VudHJ5OnNlbnRyeS1hbmRyb2lkLW5kayIsInZlcnNpb24iOiI4LjYuMCJ9XSwiaW50ZWdyYXRpb25zIjpbIkFwcFN0YXJ0SW5zdHJ1bWVudGF0aW9uIiwiQ29tcG9zZUluc3RydW1lbnRhdGlvbiIsIkRhdGFiYXNlSW5zdHJ1bWVudGF0aW9uIiwiRmlsZUlPSW5zdHJ1bWVudGF0aW9uIiwiTG9nY2F0SW5zdHJ1bWVudGF0aW9uIiwiVW5jYXVnaHRFeGNlcHRpb25IYW5kbGVyIiwiU2h1dGRvd25Ib29rIiwiU2VuZENhY2hlZEVudmVsb3BlIiwiTmRrIiwiQXBwTGlmZWN5Y2xlIiwiQW5yVjIiLCJBcHBDb21wb25lbnRzQnJlYWRjcnVtYnMiLCJFbnZlbG9wZUZpbGVPYnNlcnZlciIsIlN5c3RlbUV2ZW50c0JyZWFkY3J1bWJzIl19LCJ0YWdzIjp7ImlzU2lkZUxvYWRlZCI6InRydWUifSwicmVsZWFzZSI6ImNvbS5leGFtcGxlLm15YXBwbGljYXRpb25AMS4wKzEiLCJlbnZpcm9ubWVudCI6InByb2R1Y3Rpb24iLCJwbGF0Zm9ybSI6ImphdmEiLCJ1c2VyIjp7ImlkIjoiNjFmZjQ0OTgwZDk1NDE5NWIwOGMyZWVkODFlMTkxMDQifSwiZGlzdCI6IjEiLCJicmVhZGNydW1icyI6W3sidGltZXN0YW1wIjoiMjAyNS0wNC0wM1QxMzoxNjowMi42MDlaIiwidHlwZSI6Im5hdmlnYXRpb24iLCJkYXRhIjp7InN0YXRlIjoiZm9yZWdyb3VuZCJ9LCJjYXRlZ29yeSI6ImFwcC5saWZlY3ljbGUiLCJsZXZlbCI6ImluZm8ifSx7InRpbWVzdGFtcCI6IjIwMjUtMDQtMDNUMTM6MTY6MDQuMzMxWiIsInR5cGUiOiJzeXN0ZW0iLCJkYXRhIjp7ImxldmVsIjoxMDAuMCwiY2hhcmdpbmciOmZhbHNlLCJhY3Rpb24iOiJCQVRURVJZX0NIQU5HRUQifSwiY2F0ZWdvcnkiOiJkZXZpY2UuZXZlbnQiLCJsZXZlbCI6ImluZm8ifV19CnsiY29udGVudF90eXBlIjoiYXBwbGljYXRpb24vanNvbiIsInR5cGUiOiJzZXNzaW9uIiwibGVuZ3RoIjoyODd9Cnsic2lkIjoiNzEzZWQwMzViYjI5NDI2Mzk2MmE4YTAxZGNkZTVjNTIiLCJkaWQiOiI2MWZmNDQ5ODBkOTU0MTk1YjA4YzJlZWQ4MWUxOTEwNCIsInN0YXJ0ZWQiOiIyMDI1LTA0LTAzVDEzOjE2OjAyLjE3N1oiLCJzdGF0dXMiOiJvayIsInNlcSI6MTc0MzY4NjE5ODQ2NywiZXJyb3JzIjoyODcsInRpbWVzdGFtcCI6IjIwMjUtMDQtMDNUMTM6MTY6MzguNDY3WiIsImF0dHJzIjp7InJlbGVhc2UiOiJjb20uZXhhbXBsZS5teWFwcGxpY2F0aW9uQDEuMCsxIiwiZW52aXJvbm1lbnQiOiJwcm9kdWN0aW9uIn19Cg==',
      },
      catcherType: 'external/sentry',
    };

    it('should correctly parse string envelope with cyrillic chars in exception title', async () => {
      await worker.handle(event as SentryEventWorkerTask);

      const addedTaskPayload = getAddTaskPayloadFromLastCall();

      expect(addedTaskPayload).toMatchObject({
        payload: expect.objectContaining({
          title: 'Exception: Тестовая ошибка #287',
        }),
      });
    });

    it('should correctly parse buffer envelope with cyrillic chars in exception title', async () => {
      const eventBuffered = event as SentryEventWorkerTask & {
        payload: {
          envelope: Buffer;
        };
      };

      (eventBuffered.payload as {
        envelope: Buffer
      }).envelope = base64toBuffer(event.payload.envelope);

      await worker.handle(event as SentryEventWorkerTask);

      const addedTaskPayload = getAddTaskPayloadFromLastCall();

      expect(addedTaskPayload).toMatchObject({
        payload: expect.objectContaining({
          title: 'Exception: Тестовая ошибка #287',
        }),
      });
    });
  });
});
