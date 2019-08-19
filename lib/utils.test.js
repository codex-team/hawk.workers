const utils = require('./utils');

describe('Utils', () => {
  const dataProvider = [
    {
      sourceObject: {
        a: 3,
        d: 1,
        b: {
          c: {
            d: 6,
            e: []
          }
        }
      },
      targetObject: {
        a: 2,
        b: {
          c: {
            d: 5,
            e: [1, 1, 2]
          }
        }
      },
      expected: {
        a: 2,
        b: {
          c: {
            d: 5,
            e: [1, 1, 2]
          }
        }
      }
    },
    {
      sourceObject: {
        a: 3,
        d: 1,
        b: {
          c: {
            d: 6,
            e: []
          }
        }
      },
      targetObject: {
        a: 3,
        b: {
          c: {
            d: 6,
            e: []
          }
        }
      },
      expected: {
        b: {
          c: {
            e: []
          }
        }
      }
    }
  ];

  test('should return right object diff', () => {
    dataProvider.forEach((testCase) => {
      const result = utils.deepDiff(testCase.sourceObject, testCase.targetObject);
      expect(result).toEqual(testCase.expected);
    });
  });
});
