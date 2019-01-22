let mongoose = require('mongoose');
let Schema = mongoose.Schema;

/**
 * Hawk event format
 */
let eventSchema = new Schema({
  /**
   * Project's JWT
   */
  token: {
    type: String,
    required: true
  },

  /**
   * Type of an event
   */
  // eslint-disable-next-line camelcase
  catcher_type: {
    type: String,
    default: 'unknown'
  },

  /**
   * Event data
   */
  payload: {
    /**
     * Event title
     */
    title: String,

    /**
     * Event datetime
     */
    timestamp: Date,

    /**
     * Event severity level
     */
    severity: Number,

    /**
     * @optional
     * Event stack array from the latest call to the earliest
     */
    backtrace: [
      {
        /**
         * Source filepath
         */
        file: String,

        /**
         * Called line
         */
        line: Number,

        /**
         * @optional
         * Part of source code file near the called line
         */
        // eslint-disable-next-line camelcase
        source_code: [
          {
            /**
             * Line's number
             */
            // eslint-disable-next-line camelcase
            line_number: Number,

            /**
             * Line's content
             */
            content: String
          }
        ]
      }
    ],

    /**
     * @optional
     * Any additional data to be shown on the event's page
     */
    get: {
      type: Map,
      of: Schema.Types.Mixed
    },

    /**
     * @optional
     * Any additional data to be shown on the event's page
     */
    post: {
      type: Map,
      of: Schema.Types.Mixed
    },

    /**
     * @optional
     * HTTP headers
     */
    headers: {
      type: Map,
      of: Schema.Types.Mixed
    },

    /**
     * @optional
     * Source code version identifier
     * Version, modify timestamp or both of them combined
     */
    release: String,

    /**
     * @optional
     * Custom comments
     */
    comment: Schema.Types.Mixed
  }
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
