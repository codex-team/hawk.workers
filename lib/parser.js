/**
 * This file contains message parser.
 *
 * Whenever Queue pushes or pops a message, it gets processed using Parsers's methods.
 *
 * Parser class prepares(serializes) your message so you don't need to worry about converting,
 * for example, a JS object to supported data format of database.
 * For instanse Redis does not support JSON format, so we convert any JSONable JS data type to string.
 *
 * `prepare` — converts a message to specified format,
 * `parse` — converts from specified format to JS object.
 * For example, if we pop a message, we call `parser.parse(msg)`.
 *
 * This allows us to use many data formats like json, msgpack, binary, etc.
 * You can write your own parser just by inheriting from `Parser` and implementing `prepare` and `parse`.
 */

/**
 * Praser error class
 */
class ParserError extends Error {}

/**
 * Parser base class
 */
class Parser {
  /**
   * Prepare message.
   * Here you convert a message to specified data format.
   * Method called when sending a message.
   * @param {any} msg Message.
   * @throws {Error} Not implemented.
   * @returns {void}
   */
  prepare(msg) {
    throw new Error('Not implemented');
  }

  /**
   * Parse message.
   * Here you convert a message from specified data format.
   * Method called when receiving a message.
   * @param {any} msg Message.
   * @throws {Error} Not implemented.
   * @returns {void}
   */
  parse(msg) {
    throw new Error('Not implemented');
  }
}

module.exports = {
  Parser,
  ParserError
};
