let mongoose = require('mongoose');
let Schema = mongoose.Schema;

/**
 * Payload data format
 */
let dataSchema = new Schema({
  /**
   * Event data
   */
  payload: {
    type: Schema.Types.Mixed,
    required: true
  },

  /**
   * @optional
   * meta info
   */
  meta: Schema.Types.Mixed
});

const Data = mongoose.model('Data', dataSchema);

module.exports = Data;
