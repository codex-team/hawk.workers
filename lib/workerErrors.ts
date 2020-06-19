/**
 * Class for critical errors
 * have to stop process
 */
export class CriticalError extends Error {
}

/**
 * Class for non-critical errors
 * have not to stop process
 */
export class NonCriticalError extends Error {
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
