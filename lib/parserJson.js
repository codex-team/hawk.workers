const {
  Parser, ParserError
} = require('./parser');

/**
 * Json message parser for Queue
 */
class JsonParser extends Parser {
  /**
   * Prepare message: convert a JS object to JSON string.
   * @param {object} msg Message.
   * @returns {string} Prepared message.
   * @throws {ParserError}
   */
  static prepare(msg) {
    try {
      return JSON.stringify(msg);
    } catch (e) {
      throw new ParserError('Serialization error, can not stringify to json');
    }
  }

  /**
   * Parse message: convert a JSON string to JS object.
   * @param {object} msg Message.
   * @returns {string} Parsed message.
   * @throws {ParserError}
   */
  static parse(msg) {
    try {
      return JSON.parse(msg);
    } catch (e) {
      throw new ParserError('Parsing error, can not parse json');
    }
  }
}

module.exports = { JsonParser };
