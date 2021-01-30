import { createLogger as createWinstonLogger, format, transports, Logger } from 'winston';

/**
 *
 */
export default function createLogger(): Logger {
  return createWinstonLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports: [
      new transports.Console({
        format: format.combine(
          format.timestamp(),
          format.colorize(),
          format.simple(),
          format.printf((msg) => `${msg.timestamp} - ${msg.level}: ${msg.message}`)
        ),
      }),
    ],
  });
}
