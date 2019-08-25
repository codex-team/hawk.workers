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
      expectedDiff: {
        a: 2,
        b: {
          c: {
            d: 5,
            e: [1, 1, 2]
          }
        }
      },
      expectedMerge: {
        a: 2,
        d: 1,
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
      expectedDiff: {
        b: {
          c: {
            e: []
          }
        }
      },
      expectedMerge: {
        a: 3,
        d: 1,
        b: {
          c: {
            d: 6,
            e: []
          }
        }
      }
    }
  ];

  test('should return right object diff', () => {
    dataProvider.forEach((testCase) => {
      const diff = utils.deepDiff(testCase.sourceObject, testCase.targetObject);

      expect(diff).toEqual(testCase.expectedDiff);
    });
  });

  test('should return right object merge', () => {
    dataProvider.forEach((testCase) => {
      const diff = utils.deepDiff(testCase.sourceObject, testCase.targetObject);
      const merge = utils.deepMerge(testCase.sourceObject, diff);

      expect(merge).toEqual(testCase.expectedMerge);
    });
  });
});
