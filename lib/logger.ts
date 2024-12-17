import { createLogger as createWinstonLogger, format, transports, Logger } from 'winston';

/**
 * Extend Logger interface with custom "json" method
 */
interface CustomLogger extends Logger {
  /**
   * Method for logging JSON objects
   *
   * @param obj - JSON object to log
   *
   * @example
   * logger.json({ foo: 'bar' });
   */
  json: (obj: unknown) => void;
}

/**
 * Creates new logger instance
 */
export default function createLogger(): CustomLogger {
  const logger = createWinstonLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports: [
      new transports.Console({
        format: format.combine(
          format.errors({ stack: true }),
          format.timestamp(),
          format.colorize(),
          format.simple(),
          format.printf(({ level, message, timestamp, stack }) => {
            if (stack) {
              return `${timestamp} ${level}: ${message} - ${stack}`;
            }

            return `${timestamp} ${level}: ${message}`;
          })
        ),
      }),
    ],
  }) as CustomLogger;

  /**
   * Method for logging JSON objects
   *
   * @param obj - JSON object to log
   *
   * @example
   * logger.json({ foo: 'bar' });
   */
  logger.json = function (obj: unknown): void {
    const indent = 2;

    /**
     * Convert object to formatted string with proper indentation
     */
    const formattedJson = typeof obj === 'string'
      ? JSON.stringify(JSON.parse(obj), null, indent)
      : JSON.stringify(obj, null, indent);

    /**
     * Split the JSON string into lines
     */
    const lines = formattedJson.split('\n');

    /**
     * Log each line to preserve formatting and colors
     */
    lines.forEach(line => {
      this.info(line);
    });
  };

  return logger;
}
