import SentryEventWorker from '../src';
import '../../../env-test';
import { mockedAmqpChannel } from '../../../jest.setup.js';
import { EventEnvelope, serializeEnvelope, SeverityLevel } from '@sentry/core';
import { b64encode } from '../src/utils/base64';
import { EventWorkerTask } from '../../../lib/types/event-worker-task';

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
        catcherType: 'errors/sentry',
      });

      expect(mockedAmqpChannel.sendToQueue).toHaveBeenCalledTimes(2);
    });

    it('should handle invalid base64 payload', async () => {
      const invalidPayload = {
        payload: {
          envelope: 'invalid-base64!',
        },
        projectId: '123',
        catcherType: 'errors/sentry' as const,
      };

      worker.muteLogger(true);
      await expect(worker.handle(invalidPayload)).rejects.toThrow();
      worker.muteLogger(false);
    });

    it('should handle empty envelope', async () => {
      const emptyEnvelope = [
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
          envelope: b64encode(JSON.stringify(emptyEnvelope)),
        },
        projectId: '123',
        catcherType: 'errors/sentry',
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
        catcherType: 'errors/sentry',
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
        catcherType: 'errors/sentry',
      })).rejects.toThrow();
      worker.muteLogger(false);
    });
  });

  describe('transformToHawkFormat()', () => {
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
          catcherType: 'errors/sentry',
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
          catcherType: 'errors/sentry',
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
        catcherType: 'errors/sentry',
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
        catcherType: 'errors/sentry',
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
        catcherType: 'errors/sentry',
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
        catcherType: 'errors/sentry',
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
        catcherType: 'errors/sentry',
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
        catcherType: 'errors/sentry',
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
        catcherType: 'errors/sentry',
      });

      const addedTaskPayload = getAddTaskPayloadFromLastCall();

      expect(addedTaskPayload).toMatchObject({
        payload: expect.objectContaining({
          release: '1.0.1',
        }),
      });
    });
  });
});
