/**
 * Class for critical errors
 * have to stop process
 */
import { EventAddons, EventContext, EventDataAccepted } from '@hawk.so/types';

/**
 * Error class with additional error context for debugging
 */
export class ErrorWithContext extends Error {
  /**
   * Additional event context for debugging
   */
  public context?: EventContext;

  /**
   * @param msg - error message
   * @param context - additional event context for debugging
   */
  constructor(msg?: string | Error, context?: EventContext) {
    super(msg.toString());
    this.context = context;
  }
}

/**
 * Class for critical errors that can stop the process
 */
export class CriticalError extends ErrorWithContext {
}

/**
 * Class for non-critical errors
 * have not to stop process
 */
export class NonCriticalError extends ErrorWithContext {
}

/**
 * Simple class for parsing errors
 */
export class ParsingError extends NonCriticalError {
}

/**
 * Class for failed database operation errors in workers
 */
export class DatabaseReadWriteError extends NonCriticalError {
}

/**
 * Class for database errors in workers
 */
export class DatabaseConnectionError extends CriticalError {
}

/**
 * Class for validation errors
 */
export class ValidationError extends NonCriticalError {
}

/**
 * Class for representing errors during events difference calculation
 */
export class DiffCalculationError extends NonCriticalError {
  /**
   * @param msg - error message
   * @param originalEvent - original event for diff calculation
   * @param eventToCompare - second event for diff calculation
   */
  constructor(
    msg: string | Error,
    originalEvent: EventDataAccepted<EventAddons>,
    eventToCompare: EventDataAccepted<EventAddons>
  ) {
    super(msg);
    this.context = {
      originalEvent: originalEvent as unknown as Record<string, never>,
      eventToCompare: eventToCompare as unknown as Record<string, never>,
    };
  }
}
