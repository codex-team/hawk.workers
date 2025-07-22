import { BacktraceFrame, DefaultAddons, EventContext, EventData, Json, SentryAddons } from '@hawk.so/types';
import { Event as SentryEvent } from '@sentry/core';

/**
 * Compose title from Sentry event payload
 *
 * @param eventPayload - Sentry event payload
 */
export function composeTitle(eventPayload: SentryEvent): string {
  return `${eventPayload.exception?.values?.[0]?.type || 'Unknown'}: ${eventPayload.exception?.values?.[0]?.value || ''}`;
}

/**
 * Compose backtrace from Sentry event payload
 *
 * @param eventPayload - Sentry event payload
 */
export function composeBacktrace(eventPayload: SentryEvent): EventData<DefaultAddons>['backtrace'] {
  try {
    const backtrace: EventData<DefaultAddons>['backtrace'] = [];

    let frames = eventPayload.exception?.values?.[0]?.stacktrace?.frames;

    if (!frames) {
      return undefined;
    }

    /**
     * Sentry sends backtrace in reverse order
     * We need to reverse it to get the correct order
     */
    frames = [ ...frames ].reverse();

    frames.forEach((frame) => {
      const backtraceFrame: BacktraceFrame = {
        file: frame.filename || frame.abs_path || frame.module || frame.instruction_addr || 'unknown location',
        line: frame.lineno || 0,
      };

      let sourceCode: BacktraceFrame['sourceCode'];

      const isSomeLinesAvailable = frame.context_line || frame.pre_context || frame.post_context;

      if (isSomeLinesAvailable !== undefined && frame.lineno !== undefined) {
        sourceCode = [];
        const lineNo = frame.lineno;

        if (frame.pre_context) {
          sourceCode.push(...frame.pre_context.map((line: string, index: number) => ({
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            line: lineNo + index - frame.pre_context!.length,
            content: line,
          })));
        }

        if (frame.context_line) {
          sourceCode.push({
            line: lineNo,
            content: frame.context_line,
          });
        }

        if (frame.post_context) {
          sourceCode.push(...frame.post_context.map((line: string, index: number) => ({
            line: lineNo + index + 1,
            content: line,
          })));
        }

        backtraceFrame.sourceCode = sourceCode;
      }

      if (frame.colno) {
        backtraceFrame.column = frame.colno;
      }

      if (frame.function) {
        backtraceFrame.function = frame.function;
      }

      if (frame.vars) {
        backtraceFrame.arguments = Object.entries(frame.vars).map(([name, value]) => {
          return `${name}=${value}`;
        });
      }

      backtrace.push(backtraceFrame);
    });

    return backtrace.length > 0 ? backtrace : undefined;
  } catch (error) {
    return undefined;
  }
}

/**
 * Compose context from Sentry event payload
 *
 * @param eventPayload - Sentry event payload
 */
export function composeContext(eventPayload: SentryEvent): EventContext | undefined {
  if (eventPayload.contexts) {
    return eventPayload.contexts as Json;
  }

  return undefined;
}

/**
 * Compose addons from Sentry event payload
 *
 * @param eventPayload - Sentry event payload
 */
export function composeAddons(eventPayload: SentryEvent): SentryAddons {
  const addons: Record<string, unknown> = {};

  const fieldsToInclude: (keyof SentryEvent)[] = [
    'message',
    'logentry',
    'timestamp',
    'start_timestamp',
    'level',
    'platform',
    'server_name',
    'release',
    'dist',
    'environment',
    'request',
    'transaction',
    'modules',
    'fingerprint',
    'tags',
    'extra',
  ];

  fieldsToInclude.forEach((field) => {
    if (eventPayload[field] !== undefined) {
      addons[field] = eventPayload[field];
    }
  });

  return Object.keys(addons).length > 0 ? addons : undefined;
}

/**
 * Compose user data from Sentry event payload
 *
 * @param eventPayload - Sentry event payload
 */
export function composeUserData(eventPayload: SentryEvent): EventData<DefaultAddons>['user'] {
  if (eventPayload.user) {
    return {
      id: eventPayload.user.id?.toString() ?? 'unknown',
      name: eventPayload.user.username,
      url: eventPayload.user.email,
    };
  }

  return undefined;
}
