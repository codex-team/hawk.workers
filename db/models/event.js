let mongoose = require('mongoose');
let Schema = mongoose.Schema;

/**
 * Hawk event format
 */
let eventSchema = new Schema({
  /**
   * Type of an event
   */
  catcherType: {
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
    level: Number,

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
        sourceCode: [
          {
            /**
             * Line's number
             */
            // eslint-disable-next-line camelcase
            line: Number,

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
     * Any additional data
     */
    context: Schema.Types.Mixed
  }
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
