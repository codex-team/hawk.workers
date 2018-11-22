const { ParserError } = require('./parser');
const { JsonParser } = require('./parserJson');

// Assert `prepare` and `check` methods work correctly
describe('JsonParser', () => {
  // Test object
  const obj = {
    type: 'test',
    args: [ 'test' ],
    flag: true,
    num: 32197361
  };

  // Corrupted string
  const corruptStr = '{"type": "test" ,}';

  // Parser
  let parser = JsonParser;

  it('should stringify an object', () => {
    expect(parser.prepare(obj)).toBe(JSON.stringify(obj));
  });

  it('should parse an object', () => {
    expect(parser.parse(JSON.stringify(obj))).toEqual(obj);
  });

  it('should throw ParserError on corrupt string', () => {
    expect(() => parser.parse(corruptStr)).toThrowError(ParserError);
  });
});
