/**
 * Class for critical errors
 * have to stop process
 */
import { EventContext } from 'hawk.types';

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
  constructor(msg?: string, context?: EventContext) {
    super(msg);
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
