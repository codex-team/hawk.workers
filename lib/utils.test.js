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
            e: [],
          },
        },
      },
      targetObject: {
        a: 2,
        b: {
          c: {
            d: 5,
            e: [1, 1, 2],
          },
        },
      },
      expectedDiff: {
        a: 2,
        b: {
          c: {
            d: 5,
            e: [1, 1, 2],
          },
        },
      },
      expectedMerge: {
        a: 2,
        d: 1,
        b: {
          c: {
            d: 5,
            e: [1, 1, 2],
          },
        },
      },
    },
    {
      sourceObject: {
        a: 3,
        d: 1,
        b: {
          c: {
            d: 6,
            e: [],
          },
        },
      },
      targetObject: {
        a: 3,
        b: {
          c: {
            d: 6,
            e: [],
          },
        },
      },
      expectedDiff: {
        b: {
          c: {
            e: [],
          },
        },
      },
      expectedMerge: {
        a: 3,
        d: 1,
        b: {
          c: {
            d: 6,
            e: [],
          },
        },
      },
    },
    /**
     * First and Second object has array-property with different number of items
     * First has less items count.
     */

    {
      sourceObject: {
        files: [ { line: 1 }, { line: 2 } ],
      },
      targetObject: {
        files: [ { line: 1 }, { line: 2 }, { line: 3 } ],
      },
      expectedDiff: {
        files: [ {}, {}, { line: 3 } ],
      },
      expectedMerge: {
        files: [ { line: 1 }, { line: 2 }, { line: 3 } ],
      },
    },
    /**
     * First and Second object has array-property with different number of items
     * First has more items count.
     */
    {
      sourceObject: {
        files: [ { line: 1 }, { line: 2 }, { line: 3 } ],
      },
      targetObject: {
        files: [ { line: 1 }, { line: 2 } ],
      },
      expectedDiff: {
        files: [ {}, {} ],
      },
      expectedMerge: {
        files: [ { line: 1 }, { line: 2 }, { line: 3 } ],
      },
    },

    /**
     * The first - an empty array
     * The second - array with the children non-empty array
     */
    {
      sourceObject: {
        prop: [],
      },
      targetObject: {
        prop: [ [ 'i am not empty' ] ],
      },
      expectedDiff: {
        prop: [ [ 'i am not empty' ] ],
      },
      expectedMerge: {
        prop: [ [ 'i am not empty' ] ],
      },
    },

    /**
     * Trying to compare two things of different type
     */
    {
      sourceObject: [],
      targetObject: {},
      expectedDiff: undefined,
      expectedMerge: {},
    },
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

  /**
   * This test is a temporary solution to handle case with invalid events format sent by the PHP catcher
   *
   * The problem: the PHP catcher sends some data via incompatible format under invalid names and types.
   * Those fields leads to the issues with diff calculation since fields could have different structure and types.
   *
   * The solution: deepDiff will return undefined in case of comparison of things with different types
   *
   * Original issue:
   * https://github.com/codex-team/hawk.workers/issues/312
   *
   * PHP Catcher issue:
   * https://github.com/codex-team/hawk.php/issues/39
   */
  test('should not throw error comparing events with incompatible format', () => {
    const originalStackTrace = [
      {
        function: 'postAddComment',
        class: 'Components\\Comments\\Comments',
        object: {},
        type: '->',
        args: [
          286131,
          {},
        ],
      },
    ];

    const repetitionStackTrace = [
      {
        file: '/var/www/osnova/vendor/php-di/invoker/src/Invoker.php',
        line: 74,
        function: 'call_user_func_array',
        args: [
          [
            {},
            'sendWebhooksJob',
          ],
          [
            [
              {
                id: 6697,
                token: '539506',
                event: 'new_comment',
                url: 'https://callback.angry.space/vc_callback?date=2020&code=lMzBjOWZhOTM0ZDU1NTJiZjFlZmUy',
                filter: '[]',
                data: '[]',
                removed: false,
              },
            ],
            {
              type: 'new_comment',
              data: {
                id: 3206086,
                url: 'https://vc.ru/trade/286961-wildberries-zapustil-dostavku-tovarov-za-2-chasa-v-peterburge?comment=3206086',
                text: 'Это только со стороны так вроде долго, а если смотреть изнутри, то пока там освободиться купьер, пока найдут товар   пока разберуться куда везти может и 4 часа пройти.',
                media: [],
                date: '2021-08-27T18:08:30+03:00',
                creator: {
                  id: 27823,
                  avatar: 'https://leonardo.osnova.io/8ddee2e8-28e4-7863-425e-dd9b06deae5d/',
                  name: 'Vitold S.',
                  url: 'https://vc.ru/u/27823-vitold-s',
                },
                content: {
                  id: 286961,
                  title: 'Wildberries запустил доставку товаров за 2 часа в Петербурге',
                  url: 'https://vc.ru/trade/286961-wildberries-zapustil-dostavku-tovarov-za-2-chasa-v-peterburge',
                  owner: {
                    id: 199122,
                    name: 'Торговля',
                    avatar: 'https://leonardo.osnova.io/d8fbb348-a8fd-641c-55dd-6a404055b457/',
                    url: 'https://vc.ru/trade',
                  },
                },
                reply_to: {
                  id: 3205883,
                  url: 'https://vc.ru/trade/286961-wildberries-zapustil-dostavku-tovarov-za-2-chasa-v-peterburge?comment=3205883',
                  text: 'Никто не пошутил, тогда это сделаю я!\n\n- 2.. часа!!1',
                  media: [],
                  creator: {
                    id: 877711,
                    avatar: 'https://leonardo.osnova.io/476a4e2c-8045-5b77-8a37-f6b1eb58bf93/',
                    name: 'Вадим Осадчий',
                    url: 'https://vc.ru/u/877711-vadim-osadchiy',
                  },
                },
              },
            },
          ],
        ],
      },
    ];

    const diff = utils.deepDiff(originalStackTrace, repetitionStackTrace);

    expect(diff).toEqual([
      {
        file: '/var/www/osnova/vendor/php-di/invoker/src/Invoker.php',
        line: 74,
        function: 'call_user_func_array',
        args: [undefined, undefined],
      },
    ]);
  });
});
