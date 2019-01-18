let mongoose = require('mongoose');
let Schema = mongoose.Schema;

/**
 * Hawk event format
 */
let eventSchema = new Schema({

  /**
   * Project's JWT
   */
  'token': {
    type: String,
    required: true
  },

  /**
   * Type of an event
   */
  'catcher_type': {
    type: String,
    enum: ['unknown', 'error_javascript', 'error_php', 'log_nodejs', 'log_javascript', 'log_php', 'access_log', 'metrika_touch'],
    default: 'unknown'
  },

  /**
   * Main sender info
   */
  'sender': {
    /**
     * @optional (?)
     * Server of client address
     */
    'ip': String
  },

  /**
   * Event data
   */
  'payload': {
    /**
     * Event title
     */
    'title': String,

    /**
     * Event datetime
     */
    'timestamp': Number,

    /**
     * Event severity level
     */
    'severity': Number,

    /**
     * @optional
     * Event stack array from the latest call to the earliest
     */
    'backtrace': [
      {
        /**
         * Source filepath
         */
        'file': String,

        /**
         * Called line
         */
        'line': Number,

        /**
         * @optional
         * Part of source code file near the called line
         */
        'source_code': [
          {
            /**
             * Line's number
             */
            'line_number': Number,

            /**
             * Line's content
             */
            'content': String
          }
        ]
      }
    ],

    /**
     * @optional
     * Any additional data to be showen on the event's page
     */
    'get': {
      type: Map,
      of: Schema.Types.Mixed
    },

    /**
     * @optional
     * Any additional data to be showen on the event's page
     */
    'post': {
      type: Map,
      of: Schema.Types.Mixed
    },

    /**
     * @optional
     * HTTP headers
     */
    'headers': {
      type: Map,
      of: Schema.Types.Mixed
    },

    /**
     * @optional
     * Source code version identifier
     * Version, modify timestamp or both of them combined
     */
    'release': String
  }
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;