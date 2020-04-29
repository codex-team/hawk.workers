const yup = require('yup');

/**
 * @typedef {object} BacktraceSourceCode
 * @property {number} line - line's number
 * @property {string} content - line's content
 */

/**
 * @typedef {object} EventBacktraceFrame
 * @property {string} file - source filepath
 * @property {number} line - called line
 * @property {number} column - called column
 * @property {BacktraceSourceCode[]} [sourceCode] - part of source code file near the called line
 * @property {string} [function] - if catcher can extract function name from the original stack frame
 * @property {string[]} [arguments] - if catcher can extract function arguments from the original stack frame
 */

/**
 * @typedef {object} EventUser
 * @property {number} id - user id
 * @property {string} name - user name
 * @property {string} url - user url
 * @property {string} photo - user photo
 */

/**
 * @typedef {object} EventSchema
 * @property {string} catcherType - type of an event
 * @property {object} payload - event data
 * @property {string} payload.title - event title
 * @property {Date} payload.timestamp - event datetime
 * @property {number} payload.level - event severity level
 * @property {EventBacktraceFrame[]} [payload.backtrace] - event stack array from the latest call to the earliest
 * @property {object} [payload.get] - GET params
 * @property {object} [payload.post] - POST params
 * @property {object} [payload.headers] - HTTP headers
 * @property {string} [payload.release] - source code version identifier; version, modify timestamp or both of them combined
 * @property {EventUser} [payload.user] - current authenticated user
 * @property {object} [payload.context] - any additional data
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
                .required(),
            })
          ),
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
        image: yup.string(),
      }),
      context: yup.mixed(),
    })
    .required(),
});

module.exports = {
  eventSchema,
};
