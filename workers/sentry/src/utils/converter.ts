import { BacktraceFrame, Breadcrumb, DefaultAddons, EventContext, EventData, Json, JsonNode, SentryAddons } from '@hawk.so/types';
import { Breadcrumb as SentryBreadcrumb, Event as SentryEvent } from '@sentry/core';

/**
 * Flattens a nested object into an array of strings using dot notation
 * For example: {foo: 1, bar: {baz: 2}} becomes ["foo=1", "bar.baz=2"]
 *
 * @param obj - The object to flatten
 * @param prefix - The prefix to use for nested keys (used in recursion)
 */
function flattenObject(obj: unknown, prefix = ''): string[] {
  const result: string[] = [];

  if (obj === null || obj === undefined) {
    return [ prefix ? `${prefix}=${obj}` : String(obj) ];
  }

  if (typeof obj !== 'object') {
    return [ prefix ? `${prefix}=${obj}` : String(obj) ];
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return [ prefix ? `${prefix}=[]` : '[]' ];
    }

    obj.forEach((value, index) => {
      const key = prefix ? `${prefix}.${index}` : String(index);

      result.push(...flattenObject(value, key));
    });

    return result;
  }

  const entries = Object.entries(obj);

  if (entries.length === 0) {
    return [ prefix ? `${prefix}={}` : '{}' ];
  }

  entries.forEach(([key, value]) => {
    const newPrefix = prefix ? `${prefix}.${key}` : key;

    result.push(...flattenObject(value, newPrefix));
  });

  return result;
}

/**
 * Compose title from Sentry event payload
 *
 * @param eventPayload - Sentry event payload
 */
export function composeTitle(eventPayload: SentryEvent): string {
  const exception = eventPayload.exception?.values?.[0];

  if (exception) {
    return `${exception.type || 'Unknown'}: ${exception.value || ''}`;
  }

  return eventPayload.message || 'Unknown: ';
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
        backtraceFrame.arguments = Object.entries(frame.vars).flatMap(([name, value]) => {
          return flattenObject(value, name);
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

/**
 * Sentry breadcrumb types mapped to the types Hawk renders.
 * Types missing here are passed as is and displayed as 'default'.
 *
 * @see https://develop.sentry.dev/sdk/data-model/event-payloads/breadcrumbs/#breadcrumb-types
 */
const SENTRY_TO_HAWK_BREADCRUMB_TYPES: Record<string, string> = {
  default: 'default',
  debug: 'default',
  info: 'default',
  http: 'request',
  query: 'request',
  navigation: 'navigation',
  ui: 'ui',
  user: 'ui',
  error: 'error',
  transaction: 'logic',
};

/**
 * Converts a Sentry timestamp to Unix milliseconds used by Hawk breadcrumbs.
 * Sentry sends either Unix seconds (with a fraction) or an RFC 3339 string.
 *
 * @param timestamp - Sentry timestamp
 */
function toMilliseconds(timestamp: unknown): number | undefined {
  const msInSecond = 1000;

  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
    return Math.round(timestamp * msInSecond);
  }

  if (typeof timestamp === 'string') {
    const parsed = Date.parse(timestamp);

    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

/**
 * Compose breadcrumbs from Sentry event payload.
 * SDKs send them either as an array or wrapped into { values: [...] } (Python, PHP).
 * A breadcrumb without its own timestamp gets the event timestamp.
 *
 * @param eventPayload - Sentry event payload
 */
export function composeBreadcrumbs(eventPayload: SentryEvent): Breadcrumb[] | undefined {
  const raw: unknown = eventPayload.breadcrumbs;
  const items: unknown = Array.isArray(raw) ? raw : (raw as { values?: unknown } | undefined)?.values;

  if (!Array.isArray(items)) {
    return undefined;
  }

  const eventTimestamp = toMilliseconds(eventPayload.timestamp);
  const breadcrumbs: Breadcrumb[] = [];

  (items as SentryBreadcrumb[]).forEach((item) => {
    if (typeof item !== 'object' || item === null) {
      return;
    }

    const timestamp = toMilliseconds(item.timestamp) ?? eventTimestamp;

    if (timestamp === undefined) {
      return;
    }

    const breadcrumb: Breadcrumb = { timestamp };

    if (typeof item.type === 'string') {
      breadcrumb.type = SENTRY_TO_HAWK_BREADCRUMB_TYPES[item.type] ?? item.type;
    }

    if (typeof item.category === 'string') {
      breadcrumb.category = item.category;
    }

    if (typeof item.message === 'string') {
      breadcrumb.message = item.message;
    }

    if (typeof item.level === 'string') {
      breadcrumb.level = item.level;
    }

    if (typeof item.data === 'object' && item.data !== null && !Array.isArray(item.data)) {
      breadcrumb.data = item.data as Record<string, JsonNode>;
    }

    breadcrumbs.push(breadcrumb);
  });

  return breadcrumbs.length > 0 ? breadcrumbs : undefined;
}
