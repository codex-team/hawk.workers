const utils = require('./utils');

describe('Utils', () => {
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
   *
   * @todo move this test to the grouper tests and remove usage of utils.deepDiff
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
                url: 'https://callback.angry.space/vc_callback?date=2020&code=lMzBjOWZh@DADAD@jFlZmUy',
                filter: '[]',
                data: '[]',
                removed: false,
              },
            ],
            {
              type: 'new_comment',
              data: {
                id: 3206086,
                url: 'https://somesite.io/trade/286961',
                text: 'Это только со стороны так вроде долго, а если смотреть изнутри, то пока там освободиться купьер, пока найдут товар   пока разберуться куда везти может и 4 часа пройти.',
                media: [],
                date: '2021-08-27T18:08:30+03:00',
                creator: {
                  id: 27823,
                  avatar: 'https://s3.somesite.io/8ddee2e8-28e4-7863-425e-dd9b06deae5d/',
                  name: 'John S.',
                  url: 'https://somesite.io/u/27823-john-s',
                },
                content: {
                  id: 286961,
                  title: 'Wildberries запустил доставку товаров за 2 часа в Петербурге',
                  url: 'https://somesite.io/trade/286961',
                  owner: {
                    id: 199122,
                    name: 'Торговля',
                    avatar: 'https://leonardo.osnova.io/d8fbb348-a8fd-641c-55dd-6a404055b457/',
                    url: 'https://somesite.io/trade',
                  },
                },
                replyTo: {
                  id: 3205883,
                  url: 'https://somesite.io/trade/286961',
                  text: 'Никто не пошутил, тогда это сделаю я!\n\n- 2.. часа!!1',
                  media: [],
                  creator: {
                    id: 877711,
                    avatar: 'https://leonardo.osnova.io/476a4e2c-8045-5b77-8a37-f6b1eb58bf93/',
                    name: 'Вадим Осадчий',
                    url: 'https://somesite.io/u/877711-john-doe',
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
