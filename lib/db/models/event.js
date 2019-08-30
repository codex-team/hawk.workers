const yup = require('yup');

/**
 * @typedef {Object} BacktraceSourceCode
 * @property {Number} line - line's number
 * @property {string} content - line's content
 */

/**
 * @typedef {Object} EventBacktrace
 * @property {string} file - source filepath
 * @property {Number} line - called line
 * @property {BacktraceSourceCode[]} [sourceCode] - part of source code file near the called line
 */

/**
 * @typedef {Object} EventUser
 * @property {Number} id
 * @property {string} name
 * @property {string} url
 * @property {string} photo
 */

/**
 * @typedef {Object} EventSchema
 * @property {string} catcherType - type of an event
 * @property {Object} payload - event data
 * @property {string} payload.title - event title
 * @property {Date} payload.timestamp - event datetime
 * @property {Number} payload.level - event severity level
 * @property {EventBacktrace[]} [payload.backtrace] - event stack array from the latest call to the earliest
 * @property {Object} [payload.get] - GET params
 * @property {Object} [payload.post] - POST params
 * @property {Object} [payload.headers] - HTTP headers
 * @property {string} [payload.release] - source code version identifier; version, modify timestamp or both of them combined
 * @property {EventUser} [payload.user] - current authenticated user
 * @property {Object} [payload.context] - any additional data
 */

/**
 * Event validation object, corresponds to typedefs above
 * Provides `.validate` method
 */
const eventSchema = yup.object().shape({
  catcherType: yup.string().required(),
  payload: yup
    .object()
    .shape({
      title: yup.string().required(),
      timestamp: yup.number().required(),
      backtrace: yup.array().of(
        yup.object().shape({
          file: yup.string().required(),
          line: yup
            .number()
            .integer()
            .required(),
          sourceCode: yup.array().of(
            yup.object().shape({
              line: yup
                .number()
                .integer()
                .required(),
              content: yup
                .string()
                .required()
                .required()
            })
          )
        })
      ),
      get: yup.mixed(),
      post: yup.mixed(),
      headers: yup.mixed(),
      release: yup.string(),
      user: yup.object().shape({
        id: yup.string(),
        name: yup.string(),
        url: yup.string(),
        image: yup.string()
      }),
      context: yup.mixed()
    })
    .required()
});

module.exports = {
  eventSchema
};
