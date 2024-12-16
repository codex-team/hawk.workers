import SentryEventWorker from '../src';
import { SentryEventWorkerTask } from '../types/sentry-event-worker-task';
import '../../../env-test';
import { mockedAmqpChannel } from './rabbit.mock';
import { ClientReportEnvelope, ClientReportItem } from '@sentry/core';
import { b64encode } from '../src/utils/base64';
jest.mock('amqplib');

/**
 * Testing Event
 */
const testEventData = {
  projectId: '674ef84b29b1620023eb4832',
  payload: { envelope: 'eyJldmVudF9pZCI6IjE3ZDBiMWEwODJiOTQ5NTM5YThkZDFiYjY1M2MxZTE4Iiwic2VudF9hdCI6IjIwMjQtMTItMTNUMTk6NTE6MTkuMjEyNzQxWiIsInRyYWNlIjp7InRyYWNlX2lkIjoiN2MzNzJjNGNkNjNhNDVlZjg0OWRjYTdhYTAyY2Y2NTkiLCJlbnZpcm9ubWVudCI6InByb2R1Y3Rpb24iLCJyZWxlYXNlIjoiMTBiYWE4OWJhMmUwMWJjYmZlNmE4NGIyNGQ0ZTQ5YTRiOTcxYWM4MCIsInB1YmxpY19rZXkiOiJleUpwYm5SbFozSmhkR2x2Ymtsa0lqb2lPV1EwTXpVd016Z3RNV1EzT1MwME5UbGhMV0poTVdVdFpXUXdNRFZqWXpJME5UTTBJaXdpYzJWamNtVjBJam9pWkdVM09EWmtNREF0TnpFMk5pMDBaVFl6TFdJNVl6QXRZVEZqTmpjeU9XWmxPR1U1SW4wPSJ9fQp7InR5cGUiOiJldmVudCIsImNvbnRlbnRfdHlwZSI6ImFwcGxpY2F0aW9uL2pzb24iLCJsZW5ndGgiOjE5OTd9CnsibGV2ZWwiOiJlcnJvciIsImV4Y2VwdGlvbiI6eyJ2YWx1ZXMiOlt7Im1lY2hhbmlzbSI6eyJ0eXBlIjoiZXhjZXB0aG9vayIsImhhbmRsZWQiOmZhbHNlfSwibW9kdWxlIjpudWxsLCJ0eXBlIjoiWmVyb0RpdmlzaW9uRXJyb3IiLCJ2YWx1ZSI6ImRpdmlzaW9uIGJ5IHplcm8iLCJzdGFja3RyYWNlIjp7ImZyYW1lcyI6W3siZmlsZW5hbWUiOiJzZW50cnktc2VuZC5weSIsImFic19wYXRoIjoiL1VzZXJzL25vc3RyL2Rldi9jb2RleC9oYXdrLm1vbm8vdGVzdHMvbWFudWFsL3NlbnRyeS9zZW50cnktc2VuZC5weSIsImZ1bmN0aW9uIjoiPG1vZHVsZT4iLCJtb2R1bGUiOiJfX21haW5fXyIsImxpbmVubyI6MTAsInByZV9jb250ZXh0IjpbIiIsInNlbnRyeV9zZGsuaW5pdCgiLCIgICAgZHNuPWZcImh0dHA6Ly97SEFXS19JTlRFR1JBVElPTl9UT0tFTn1AbG9jYWxob3N0OjMwMDAvMFwiLCIsIiAgICBkZWJ1Zz1UcnVlIiwiKSJdLCJjb250ZXh0X2xpbmUiOiJkaXZpc2lvbl9ieV96ZXJvID0gMSAvIDAiLCJwb3N0X2NvbnRleHQiOlsicHJpbnQoXCJ0aGlzXCIpIiwicHJpbnQoXCJpc1wiKSIsInByaW50KFwib2tcIikiLCIjIHJhaXNlIEV4Y2VwdGlvbihcIlRoaXMgaXMgYSB0ZXN0IGV4Y2VwdGlvblwiKSJdLCJ2YXJzIjp7Il9fbmFtZV9fIjoiJ19fbWFpbl9fJyIsIl9fZG9jX18iOiJOb25lIiwiX19wYWNrYWdlX18iOiJOb25lIiwiX19sb2FkZXJfXyI6IjxfZnJvemVuX2ltcG9ydGxpYl9leHRlcm5hbC5Tb3VyY2VGaWxlTG9hZGVyIG9iamVjdCBhdCAweDEwNDllMTAyMD4iLCJfX3NwZWNfXyI6Ik5vbmUiLCJfX2Fubm90YXRpb25zX18iOnt9LCJfX2J1aWx0aW5zX18iOiI8bW9kdWxlICdidWlsdGlucycgKGJ1aWx0LWluKT4iLCJfX2ZpbGVfXyI6IicvVXNlcnMvbm9zdHIvZGV2L2NvZGV4L2hhd2subW9uby90ZXN0cy9tYW51YWwvc2VudHJ5L3NlbnRyeS1zZW5kLnB5JyIsIl9fY2FjaGVkX18iOiJOb25lIiwic2VudHJ5X3NkayI6Ijxtb2R1bGUgJ3NlbnRyeV9zZGsnIGZyb20gJy9Vc2Vycy9ub3N0ci9kZXYvY29kZXgvaGF3ay5tb25vLy52ZW52L2xpYi9weXRob24zLjEzL3NpdGUtcGFja2FnZXMvc2VudHJ5X3Nkay9fX2luaXRfXy5weSc+In0sImluX2FwcCI6dHJ1ZX1dfX1dfSwiZXZlbnRfaWQiOiIxN2QwYjFhMDgyYjk0OTUzOWE4ZGQxYmI2NTNjMWUxOCIsInRpbWVzdGFtcCI6IjIwMjQtMTItMTNUMTk6NTE6MTkuMjA3NDA1WiIsImNvbnRleHRzIjp7InRyYWNlIjp7InRyYWNlX2lkIjoiN2MzNzJjNGNkNjNhNDVlZjg0OWRjYTdhYTAyY2Y2NTkiLCJzcGFuX2lkIjoiOGYwZjBkOTBiMDhkYjdhYSIsInBhcmVudF9zcGFuX2lkIjpudWxsfSwicnVudGltZSI6eyJuYW1lIjoiQ1B5dGhvbiIsInZlcnNpb24iOiIzLjEzLjAiLCJidWlsZCI6IjMuMTMuMCAobWFpbiwgT2N0ICA3IDIwMjQsIDA1OjAyOjE0KSBbQ2xhbmcgMTYuMC4wIChjbGFuZy0xNjAwLjAuMjYuMyldIn19LCJ0cmFuc2FjdGlvbl9pbmZvIjp7fSwiYnJlYWRjcnVtYnMiOnsidmFsdWVzIjpbXX0sImV4dHJhIjp7InN5cy5hcmd2IjpbInNlbnRyeS1zZW5kLnB5Il19LCJtb2R1bGVzIjp7InBpcCI6IjI0LjMuMSIsInVybGxpYjMiOiIyLjIuMyIsInNlbnRyeS1zZGsiOiIyLjE5LjAiLCJjZXJ0aWZpIjoiMjAyNC44LjMwIn0sInJlbGVhc2UiOiIxMGJhYTg5YmEyZTAxYmNiZmU2YTg0YjI0ZDRlNDlhNGI5NzFhYzgwIiwiZW52aXJvbm1lbnQiOiJwcm9kdWN0aW9uIiwic2VydmVyX25hbWUiOiJNYWNCb29rLVByby1BbGVrc2FuZHItNS5sb2NhbCIsInNkayI6eyJuYW1lIjoic2VudHJ5LnB5dGhvbiIsInZlcnNpb24iOiIyLjE5LjAiLCJwYWNrYWdlcyI6W3sibmFtZSI6InB5cGk6c2VudHJ5LXNkayIsInZlcnNpb24iOiIyLjE5LjAifV0sImludGVncmF0aW9ucyI6WyJhcmd2IiwiYXRleGl0IiwiZGVkdXBlIiwiZXhjZXB0aG9vayIsImxvZ2dpbmciLCJtb2R1bGVzIiwic3RkbGliIiwidGhyZWFkaW5nIl19LCJwbGF0Zm9ybSI6InB5dGhvbiJ9Cg==' },
  catcherType: 'errors/sentry' as const,
};

describe('SentryEventWorker', () => {
  const worker = new SentryEventWorker();

  test('should not handle bad event data', async () => {
    const handleEvent = async (): Promise<void> => {
      await worker.handle({} as SentryEventWorkerTask);
    };

    expect(handleEvent).rejects.toThrowError();
  });

  test('should handle good event data', async () => {
    await worker.handle(testEventData);

    expect(mockedAmqpChannel.sendToQueue).toHaveBeenCalledTimes(1);
  });

  test('should skip non-event envelope items', async () => {
    /* eslint-disable @typescript-eslint/naming-convention */
    const nonEventItem: ClientReportItem = [
      {
        type: 'client_report',
      },
      {
        timestamp: 1718534400,
        discarded_events: [],
      },
    ];

    const envelope: ClientReportEnvelope = [
      {
        event_id: '123e4567-e89b-12d3-a456-426614174000',
        dsn: 'https://example@sentry.io/123',
        sdk: {
          name: 'sentry.javascript.node',
          version: '7.0.0',
        },
      },
      [ nonEventItem ],
    ];
    /* eslint-enable @typescript-eslint/naming-convention */

    const handleEvent = async (): Promise<void> => {
      await worker.handle({
        payload: {
          envelope: b64encode(JSON.stringify(envelope)),
        },
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        catcherType: 'errors/sentry',
      });
    };

    expect(handleEvent).not.toThrow();
    expect(mockedAmqpChannel.sendToQueue).toHaveBeenCalledTimes(0);
  });
});
