const utils = require('./utils');

const testData = {
  originalEvent: [
    {
      file: '/var/www/osnova/vendor/codex-team/hawk.php/src/Handler.php',
      line: 100,
      function: 'create',
      class: 'Hawk\\EventPayloadBuilder',
      object: {},
      type: '->',
      args: [
        {
          level: 100,
          title: 'Times Warning! t > 1000 @ New comment',
          context: [],
          user: {
            id: 94508,
            url: 'https://vc.ru/u/94508-konstantin-benner',
            name: 'Константин Беннер',
            photo: 'https://png.cmtt.space/user-userpic/ae/b3/1a/4f9120fb3478d3.jpg',
          },
        },
      ],
    },
    {
      file: '/var/www/osnova/vendor/codex-team/hawk.php/src/Catcher.php',
      line: 134,
      function: 'catchEvent',
      class: 'Hawk\\Handler',
      object: {},
      type: '->',
      args: [
        {
          level: 100,
          title: 'Times Warning! t > 1000 @ New comment',
          context: [],
          user: {
            id: 94508,
            url: 'https://vc.ru/u/94508-konstantin-benner',
            name: 'Константин Беннер',
            photo: 'https://png.cmtt.space/user-userpic/ae/b3/1a/4f9120fb3478d3.jpg',
          },
        },
      ],
    },
    {
      file: '/var/www/osnova/src/Osnova/Helper/HawkHandler.php',
      line: 41,
      function: 'sendEvent',
      class: 'Hawk\\Catcher',
      object: {},
      type: '->',
      args: [
        {
          level: 100,
          title: 'Times Warning! t > 1000 @ New comment',
          context: [],
        },
      ],
    },
    {
      file: '/var/www/osnova/vendor/monolog/monolog/src/Monolog/Handler/AbstractProcessingHandler.php',
      line: 42,
      function: 'write',
      class: 'Osnova\\Helper\\HawkHandler',
      object: {},
      type: '->',
      args: [
        {
          message: 'Times Warning! t > 1000 @ New comment',
          context: {
            final_time: 1796,
            times: [
              'start: 0 ms',
              'getting content: 4 ms',
              'check rights: 7 ms',
              'preparing: 5 ms',
              'save to db: 1648 ms',
              'trigger comment_added: 11 ms',
              'live trigger: 14 ms',
              'sockets: 78 ms',
              'comment add — clickhouse: 29 ms',
              'end: 0,0019 ms',
            ],
          },
          level: 100,
          level_name: 'DEBUG',
          channel: 'Main',
          datetime: '2021-08-26T14:12:31.230134+03:00',
          extra: {
            file: '/var/www/osnova/src/Osnova/Helper/TimesWarning.php',
            line: 108,
            class: 'Osnova\\Helper\\TimesWarning',
            function: 'end',
          },
          formatted: '[2021-08-26T14:12:31.230134+03:00] Main.DEBUG: Times Warning! t > 1000 @ New comment {"final_time":1796.0,"times":["start: 0 ms","getting content: 4 ms","check rights: 7 ms","preparing: 5 ms","save to db: 1648 ms","trigger comment_added: 11 ms","live trigger: 14 ms","sockets: 78 ms","comment add — clickhouse: 29 ms","end: 0,0019 ms"]} {"file":"/var/www/osnova/src/Osnova/Helper/TimesWarning.php","line":108,"class":"Osnova\\\\Helper\\\\TimesWarning","function":"end"}\n',
        },
      ],
    },
    {
      file: '/var/www/osnova/vendor/monolog/monolog/src/Monolog/Logger.php',
      line: 317,
      function: 'handle',
      class: 'Monolog\\Handler\\AbstractProcessingHandler',
      object: {},
      type: '->',
      args: [
        {
          message: 'Times Warning! t > 1000 @ New comment',
          context: {
            final_time: 1796,
            times: [
              'start: 0 ms',
              'getting content: 4 ms',
              'check rights: 7 ms',
              'preparing: 5 ms',
              'save to db: 1648 ms',
              'trigger comment_added: 11 ms',
              'live trigger: 14 ms',
              'sockets: 78 ms',
              'comment add — clickhouse: 29 ms',
              'end: 0,0019 ms',
            ],
          },
          level: 100,
          level_name: 'DEBUG',
          channel: 'Main',
          datetime: '2021-08-26T14:12:31.230134+03:00',
          extra: {
            file: '/var/www/osnova/src/Osnova/Helper/TimesWarning.php',
            line: 108,
            class: 'Osnova\\Helper\\TimesWarning',
            function: 'end',
          },
          formatted: '[2021-08-26T14:12:31.230134+03:00] Main.DEBUG: Times Warning! t > 1000 @ New comment {"final_time":1796.0,"times":["start: 0 ms","getting content: 4 ms","check rights: 7 ms","preparing: 5 ms","save to db: 1648 ms","trigger comment_added: 11 ms","live trigger: 14 ms","sockets: 78 ms","comment add — clickhouse: 29 ms","end: 0,0019 ms"]} {"file":"/var/www/osnova/src/Osnova/Helper/TimesWarning.php","line":108,"class":"Osnova\\\\Helper\\\\TimesWarning","function":"end"}\n',
        },
      ],
    },
    {
      file: '/var/www/osnova/vendor/monolog/monolog/src/Monolog/Logger.php',
      line: 474,
      function: 'addRecord',
      class: 'Monolog\\Logger',
      object: {},
      type: '->',
      args: [
        100,
        'Times Warning! t > 1000 @ New comment',
        {
          final_time: 1796,
          times: [
            'start: 0 ms',
            'getting content: 4 ms',
            'check rights: 7 ms',
            'preparing: 5 ms',
            'save to db: 1648 ms',
            'trigger comment_added: 11 ms',
            'live trigger: 14 ms',
            'sockets: 78 ms',
            'comment add — clickhouse: 29 ms',
            'end: 0,0019 ms',
          ],
        },
      ],
    },
    {
      file: '/var/www/osnova/src/Osnova/Helper/TimesWarning.php',
      line: 108,
      function: 'log',
      class: 'Monolog\\Logger',
      object: {},
      type: '->',
      args: [
        100,
        'Times Warning! t > 1000 @ New comment',
        {
          final_time: 1796,
          times: [
            'start: 0 ms',
            'getting content: 4 ms',
            'check rights: 7 ms',
            'preparing: 5 ms',
            'save to db: 1648 ms',
            'trigger comment_added: 11 ms',
            'live trigger: 14 ms',
            'sockets: 78 ms',
            'comment add — clickhouse: 29 ms',
            'end: 0,0019 ms',
          ],
        },
      ],
    },
    {
      file: '/var/www/osnova/src/Components/Comments/Comments.php',
      line: 1461,
      function: 'end',
      class: 'Osnova\\Helper\\TimesWarning',
      object: {},
      type: '->',
      args: [],
    },
    {
      file: '/var/www/osnova/src/Components/Comments/Comments.php',
      line: 732,
      function: 'addComment',
      class: 'Components\\Comments\\Comments',
      object: {},
      type: '->',
      args: [
        {},
        {},
      ],
    },
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
    {
      file: '/var/www/osnova/vendor/php-di/invoker/src/Invoker.php',
      line: 74,
      function: 'call_user_func_array',
      args: [
        [
          {},
          'postAddComment',
        ],
        [
          '286131',
          {},
        ],
      ],
    },
    {
      file: '/var/www/osnova/vendor/php-di/php-di/src/Container.php',
      line: 276,
      function: 'call',
      class: 'Invoker\\Invoker',
      object: {},
      type: '->',
      args: [
        [
          {},
          'postAddComment',
        ],
        {
          id: '286131',
        },
      ],
    },
    {
      file: '/var/www/osnova/src/Osnova/Helper/App.php',
      line: 981,
      function: 'call',
      class: 'DI\\Container',
      object: {},
      type: '->',
      args: [
        [
          'Components\\Comments\\Comments',
          'postAddComment',
        ],
        {
          id: '286131',
        },
      ],
    },
    {
      file: '/var/www/osnova/src/Osnova/Helper/App.php',
      line: 263,
      function: 'call',
      class: 'Osnova\\Helper\\App',
      type: '::',
      args: [
        [
          'Components\\Comments\\Comments',
          'postAddComment',
        ],
        {
          id: '286131',
        },
      ],
    },
    {
      file: '/var/www/osnova/public/index.php',
      line: 49,
      function: 'requestFire',
      class: 'Osnova\\Helper\\App',
      type: '::',
      args: [
        'POST',
        '/comments/286131/add',
      ],
    },
  ],
  eventToCompare: [
    {
      file: '/var/www/osnova/vendor/codex-team/hawk.php/src/Handler.php',
      line: 100,
      function: 'create',
      class: 'Hawk\\EventPayloadBuilder',
      object: {},
      type: '->',
      args: [
        {
          level: 100,
          title: 'Webhooks: Not a 200 code watcher#6697',
          context: [],
          user: [],
        },
      ],
    },
    {
      file: '/var/www/osnova/vendor/codex-team/hawk.php/src/Catcher.php',
      line: 134,
      function: 'catchEvent',
      class: 'Hawk\\Handler',
      object: {},
      type: '->',
      args: [
        {
          level: 100,
          title: 'Webhooks: Not a 200 code watcher#6697',
          context: [],
          user: [],
        },
      ],
    },
    {
      file: '/var/www/osnova/src/Osnova/Helper/HawkHandler.php',
      line: 41,
      function: 'sendEvent',
      class: 'Hawk\\Catcher',
      object: {},
      type: '->',
      args: [
        {
          level: 100,
          title: 'Webhooks: Not a 200 code watcher#6697',
          context: [],
        },
      ],
    },
    {
      file: '/var/www/osnova/vendor/monolog/monolog/src/Monolog/Handler/AbstractProcessingHandler.php',
      line: 42,
      function: 'write',
      class: 'Osnova\\Helper\\HawkHandler',
      object: {},
      type: '->',
      args: [
        {
          message: 'Webhooks: Not a 200 code watcher#6697',
          context: {
            watcher: {
              id: 6697,
              token: '539506',
              event: 'new_comment',
              url: 'https://callback.angry.space/vc_callback?date=2020&code=lMzBjOWZhOTM0ZDU1NTJiZjFlZmUy',
              filter: '[]',
              data: [],
              removed: false,
            },
            attempts: 1,
          },
          level: 100,
          level_name: 'DEBUG',
          channel: 'Main',
          datetime: '2021-08-27T18:08:33.305038+03:00',
          extra: {
            file: '/var/www/osnova/src/Osnova/Webhooks/Webhooks.php',
            line: 298,
            class: 'Osnova\\Webhooks\\Webhooks',
            function: 'sendWebhooks',
          },
          formatted: '[2021-08-27T18:08:33.305038+03:00] Main.DEBUG: Webhooks: Not a 200 code watcher#6697 {"watcher":{"id":6697,"token":"539506","event":"new_comment","url":"https://callback.angry.space/vc_callback?date=2020&code=lMzBjOWZhOTM0ZDU1NTJiZjFlZmUy","filter":"[]","data":[],"removed":false},"attempts":1} {"file":"/var/www/osnova/src/Osnova/Webhooks/Webhooks.php","line":298,"class":"Osnova\\\\Webhooks\\\\Webhooks","function":"sendWebhooks"}\n',
        },
      ],
    },
    {
      file: '/var/www/osnova/vendor/monolog/monolog/src/Monolog/Logger.php',
      line: 317,
      function: 'handle',
      class: 'Monolog\\Handler\\AbstractProcessingHandler',
      object: {},
      type: '->',
      args: [
        {
          message: 'Webhooks: Not a 200 code watcher#6697',
          context: {
            watcher: {
              id: 6697,
              token: '539506',
              event: 'new_comment',
              url: 'https://callback.angry.space/vc_callback?date=2020&code=lMzBjOWZhOTM0ZDU1NTJiZjFlZmUy',
              filter: '[]',
              data: [],
              removed: false,
            },
            attempts: 1,
          },
          level: 100,
          level_name: 'DEBUG',
          channel: 'Main',
          datetime: '2021-08-27T18:08:33.305038+03:00',
          extra: {
            file: '/var/www/osnova/src/Osnova/Webhooks/Webhooks.php',
            line: 298,
            class: 'Osnova\\Webhooks\\Webhooks',
            function: 'sendWebhooks',
          },
          formatted: '[2021-08-27T18:08:33.305038+03:00] Main.DEBUG: Webhooks: Not a 200 code watcher#6697 {"watcher":{"id":6697,"token":"539506","event":"new_comment","url":"https://callback.angry.space/vc_callback?date=2020&code=lMzBjOWZhOTM0ZDU1NTJiZjFlZmUy","filter":"[]","data":[],"removed":false},"attempts":1} {"file":"/var/www/osnova/src/Osnova/Webhooks/Webhooks.php","line":298,"class":"Osnova\\\\Webhooks\\\\Webhooks","function":"sendWebhooks"}\n',
        },
      ],
    },
    {
      file: '/var/www/osnova/vendor/monolog/monolog/src/Monolog/Logger.php',
      line: 487,
      function: 'addRecord',
      class: 'Monolog\\Logger',
      object: {},
      type: '->',
      args: [
        100,
        'Webhooks: Not a 200 code watcher#6697',
        {
          watcher: {
            id: 6697,
            token: '539506',
            event: 'new_comment',
            url: 'https://callback.angry.space/vc_callback?date=2020&code=lMzBjOWZhOTM0ZDU1NTJiZjFlZmUy',
            filter: '[]',
            data: [],
            removed: false,
          },
          attempts: 1,
        },
      ],
    },
    {
      file: '/var/www/osnova/src/Osnova/Webhooks/Webhooks.php',
      line: 298,
      function: 'debug',
      class: 'Monolog\\Logger',
      object: {},
      type: '->',
      args: [
        'Webhooks: Not a 200 code watcher#6697',
        {
          watcher: {
            id: 6697,
            token: '539506',
            event: 'new_comment',
            url: 'https://callback.angry.space/vc_callback?date=2020&code=lMzBjOWZhOTM0ZDU1NTJiZjFlZmUy',
            filter: '[]',
            data: [],
            removed: false,
          },
          attempts: 1,
        },
      ],
    },
    {
      file: '/var/www/osnova/src/Components/Queue/Jobs.php',
      line: 192,
      function: 'sendWebhooks',
      class: 'Osnova\\Webhooks\\Webhooks',
      object: {
        attempt_count: 2,
        failed_attempt_count: 20,
      },
      type: '->',
      args: [
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
    },
    {
      function: 'sendWebhooksJob',
      class: 'Components\\Queue\\Jobs',
      object: {},
      type: '->',
      args: [
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
    },
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
    {
      file: '/var/www/osnova/vendor/php-di/php-di/src/Container.php',
      line: 276,
      function: 'call',
      class: 'Invoker\\Invoker',
      object: {},
      type: '->',
      args: [
        [
          {},
          'sendWebhooksJob',
        ],
        {
          watchers: [
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
          data: {
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
        },
      ],
    },
    {
      file: '/var/www/osnova/src/Osnova/Helper/App.php',
      line: 981,
      function: 'call',
      class: 'DI\\Container',
      object: {},
      type: '->',
      args: [
        [
          'Components\\Queue\\Jobs',
          'sendWebhooksJob',
        ],
        {
          watchers: [
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
          data: {
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
        },
      ],
    },
    {
      file: '/var/www/osnova/src/Osnova/RabbitMQ/Consumers/Universal.php',
      line: 69,
      function: 'call',
      class: 'Osnova\\Helper\\App',
      type: '::',
      args: [
        [
          'Components\\Queue\\Jobs',
          'sendWebhooksJob',
        ],
        {
          watchers: [
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
          data: {
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
        },
      ],
    },
    {
      function: 'handleMessage',
      class: 'Osnova\\RabbitMQ\\Consumers\\Universal',
      object: {},
      type: '->',
      args: [
        {
          body: '{"component":"Queue","method":{"Jobs":"sendWebhooksJob"},"parameters":{"watchers":[{"id":6697,"token":"539506","event":"new_comment","url":"https:\\/\\/callback.angry.space\\/vc_callback?date=2020&code=lMzBjOWZhOTM0ZDU1NTJiZjFlZmUy","filter":"[]","data":"[]","removed":false}],"data":{"type":"new_comment","data":{"id":3206086,"url":"https:\\/\\/vc.ru\\/trade\\/286961-wildberries-zapustil-dostavku-tovarov-za-2-chasa-v-peterburge?comment=3206086","text":"\\u042d\\u0442\\u043e \\u0442\\u043e\\u043b\\u044c\\u043a\\u043e \\u0441\\u043e \\u0441\\u0442\\u043e\\u0440\\u043e\\u043d\\u044b \\u0442\\u0430\\u043a \\u0432\\u0440\\u043e\\u0434\\u0435 \\u0434\\u043e\\u043b\\u0433\\u043e, \\u0430 \\u0435\\u0441\\u043b\\u0438 \\u0441\\u043c\\u043e\\u0442\\u0440\\u0435\\u0442\\u044c \\u0438\\u0437\\u043d\\u0443\\u0442\\u0440\\u0438, \\u0442\\u043e \\u043f\\u043e\\u043a\\u0430 \\u0442\\u0430\\u043c \\u043e\\u0441\\u0432\\u043e\\u0431\\u043e\\u0434\\u0438\\u0442\\u044c\\u0441\\u044f \\u043a\\u0443\\u043f\\u044c\\u0435\\u0440, \\u043f\\u043e\\u043a\\u0430 \\u043d\\u0430\\u0439\\u0434\\u0443\\u0442 \\u0442\\u043e\\u0432\\u0430\\u0440   \\u043f\\u043e\\u043a\\u0430 \\u0440\\u0430\\u0437\\u0431\\u0435\\u0440\\u0443\\u0442\\u044c\\u0441\\u044f \\u043a\\u0443\\u0434\\u0430 \\u0432\\u0435\\u0437\\u0442\\u0438 \\u043c\\u043e\\u0436\\u0435\\u0442 \\u0438 4 \\u0447\\u0430\\u0441\\u0430 \\u043f\\u0440\\u043e\\u0439\\u0442\\u0438.","media":[],"date":"2021-08-27T18:08:30+03:00","creator":{"id":27823,"avatar":"https:\\/\\/leonardo.osnova.io\\/8ddee2e8-28e4-7863-425e-dd9b06deae5d\\/","name":"Vitold S.","url":"https:\\/\\/vc.ru\\/u\\/27823-vitold-s"},"content":{"id":286961,"title":"Wildberries \\u0437\\u0430\\u043f\\u0443\\u0441\\u0442\\u0438\\u043b \\u0434\\u043e\\u0441\\u0442\\u0430\\u0432\\u043a\\u0443 \\u0442\\u043e\\u0432\\u0430\\u0440\\u043e\\u0432 \\u0437\\u0430 2 \\u0447\\u0430\\u0441\\u0430 \\u0432 \\u041f\\u0435\\u0442\\u0435\\u0440\\u0431\\u0443\\u0440\\u0433\\u0435","url":"https:\\/\\/vc.ru\\/trade\\/286961-wildberries-zapustil-dostavku-tovarov-za-2-chasa-v-peterburge","owner":{"id":199122,"name":"\\u0422\\u043e\\u0440\\u0433\\u043e\\u0432\\u043b\\u044f","avatar":"https:\\/\\/leonardo.osnova.io\\/d8fbb348-a8fd-641c-55dd-6a404055b457\\/","url":"https:\\/\\/vc.ru\\/trade"}},"reply_to":{"id":3205883,"url":"https:\\/\\/vc.ru\\/trade\\/286961-wildberries-zapustil-dostavku-tovarov-za-2-chasa-v-peterburge?comment=3205883","text":"\\u041d\\u0438\\u043a\\u0442\\u043e \\u043d\\u0435 \\u043f\\u043e\\u0448\\u0443\\u0442\\u0438\\u043b, \\u0442\\u043e\\u0433\\u0434\\u0430 \\u044d\\u0442\\u043e \\u0441\\u0434\\u0435\\u043b\\u0430\\u044e \\u044f!\\n\\n- 2.. \\u0447\\u0430\\u0441\\u0430!!1","media":[],"creator":{"id":877711,"avatar":"https:\\/\\/leonardo.osnova.io\\/476a4e2c-8045-5b77-8a37-f6b1eb58bf93\\/","name":"\\u0412\\u0430\\u0434\\u0438\\u043c \\u041e\\u0441\\u0430\\u0434\\u0447\\u0438\\u0439","url":"https:\\/\\/vc.ru\\/u\\/877711-vadim-osadchiy"}}}}}}',
          body_size: 2704,
          is_truncated: false,
          content_encoding: null,
          delivery_info: {
            channel: {
              callbacks: {
                'amq.ctag-_WgISNAcARc25tLbgtIIUg': [
                  {},
                  'handleMessage',
                ],
              },
            },
            delivery_tag: 291,
            redelivered: false,
            exchange: 'webhook_events_sender',
            routing_key: '',
            consumer_tag: 'amq.ctag-_WgISNAcARc25tLbgtIIUg',
          },
        },
      ],
    },
    {
      file: '/var/www/osnova/vendor/php-amqplib/php-amqplib/PhpAmqpLib/Channel/AMQPChannel.php',
      line: 1044,
      function: 'call_user_func',
      args: [
        [
          {},
          'handleMessage',
        ],
        {
          body: '{"component":"Queue","method":{"Jobs":"sendWebhooksJob"},"parameters":{"watchers":[{"id":6697,"token":"539506","event":"new_comment","url":"https:\\/\\/callback.angry.space\\/vc_callback?date=2020&code=lMzBjOWZhOTM0ZDU1NTJiZjFlZmUy","filter":"[]","data":"[]","removed":false}],"data":{"type":"new_comment","data":{"id":3206086,"url":"https:\\/\\/vc.ru\\/trade\\/286961-wildberries-zapustil-dostavku-tovarov-za-2-chasa-v-peterburge?comment=3206086","text":"\\u042d\\u0442\\u043e \\u0442\\u043e\\u043b\\u044c\\u043a\\u043e \\u0441\\u043e \\u0441\\u0442\\u043e\\u0440\\u043e\\u043d\\u044b \\u0442\\u0430\\u043a \\u0432\\u0440\\u043e\\u0434\\u0435 \\u0434\\u043e\\u043b\\u0433\\u043e, \\u0430 \\u0435\\u0441\\u043b\\u0438 \\u0441\\u043c\\u043e\\u0442\\u0440\\u0435\\u0442\\u044c \\u0438\\u0437\\u043d\\u0443\\u0442\\u0440\\u0438, \\u0442\\u043e \\u043f\\u043e\\u043a\\u0430 \\u0442\\u0430\\u043c \\u043e\\u0441\\u0432\\u043e\\u0431\\u043e\\u0434\\u0438\\u0442\\u044c\\u0441\\u044f \\u043a\\u0443\\u043f\\u044c\\u0435\\u0440, \\u043f\\u043e\\u043a\\u0430 \\u043d\\u0430\\u0439\\u0434\\u0443\\u0442 \\u0442\\u043e\\u0432\\u0430\\u0440   \\u043f\\u043e\\u043a\\u0430 \\u0440\\u0430\\u0437\\u0431\\u0435\\u0440\\u0443\\u0442\\u044c\\u0441\\u044f \\u043a\\u0443\\u0434\\u0430 \\u0432\\u0435\\u0437\\u0442\\u0438 \\u043c\\u043e\\u0436\\u0435\\u0442 \\u0438 4 \\u0447\\u0430\\u0441\\u0430 \\u043f\\u0440\\u043e\\u0439\\u0442\\u0438.","media":[],"date":"2021-08-27T18:08:30+03:00","creator":{"id":27823,"avatar":"https:\\/\\/leonardo.osnova.io\\/8ddee2e8-28e4-7863-425e-dd9b06deae5d\\/","name":"Vitold S.","url":"https:\\/\\/vc.ru\\/u\\/27823-vitold-s"},"content":{"id":286961,"title":"Wildberries \\u0437\\u0430\\u043f\\u0443\\u0441\\u0442\\u0438\\u043b \\u0434\\u043e\\u0441\\u0442\\u0430\\u0432\\u043a\\u0443 \\u0442\\u043e\\u0432\\u0430\\u0440\\u043e\\u0432 \\u0437\\u0430 2 \\u0447\\u0430\\u0441\\u0430 \\u0432 \\u041f\\u0435\\u0442\\u0435\\u0440\\u0431\\u0443\\u0440\\u0433\\u0435","url":"https:\\/\\/vc.ru\\/trade\\/286961-wildberries-zapustil-dostavku-tovarov-za-2-chasa-v-peterburge","owner":{"id":199122,"name":"\\u0422\\u043e\\u0440\\u0433\\u043e\\u0432\\u043b\\u044f","avatar":"https:\\/\\/leonardo.osnova.io\\/d8fbb348-a8fd-641c-55dd-6a404055b457\\/","url":"https:\\/\\/vc.ru\\/trade"}},"reply_to":{"id":3205883,"url":"https:\\/\\/vc.ru\\/trade\\/286961-wildberries-zapustil-dostavku-tovarov-za-2-chasa-v-peterburge?comment=3205883","text":"\\u041d\\u0438\\u043a\\u0442\\u043e \\u043d\\u0435 \\u043f\\u043e\\u0448\\u0443\\u0442\\u0438\\u043b, \\u0442\\u043e\\u0433\\u0434\\u0430 \\u044d\\u0442\\u043e \\u0441\\u0434\\u0435\\u043b\\u0430\\u044e \\u044f!\\n\\n- 2.. \\u0447\\u0430\\u0441\\u0430!!1","media":[],"creator":{"id":877711,"avatar":"https:\\/\\/leonardo.osnova.io\\/476a4e2c-8045-5b77-8a37-f6b1eb58bf93\\/","name":"\\u0412\\u0430\\u0434\\u0438\\u043c \\u041e\\u0441\\u0430\\u0434\\u0447\\u0438\\u0439","url":"https:\\/\\/vc.ru\\/u\\/877711-vadim-osadchiy"}}}}}}',
          body_size: 2704,
          is_truncated: false,
          content_encoding: null,
          delivery_info: {
            channel: {
              callbacks: {
                'amq.ctag-_WgISNAcARc25tLbgtIIUg': [
                  {},
                  'handleMessage',
                ],
              },
            },
            delivery_tag: 291,
            redelivered: false,
            exchange: 'webhook_events_sender',
            routing_key: '',
            consumer_tag: 'amq.ctag-_WgISNAcARc25tLbgtIIUg',
          },
        },
      ],
    },
    {
      function: 'basic_deliver',
      class: 'PhpAmqpLib\\Channel\\AMQPChannel',
      object: {
        callbacks: {
          'amq.ctag-_WgISNAcARc25tLbgtIIUg': [
            {},
            'handleMessage',
          ],
        },
      },
      type: '->',
      args: [
        {},
        {
          body: '{"component":"Queue","method":{"Jobs":"sendWebhooksJob"},"parameters":{"watchers":[{"id":6697,"token":"539506","event":"new_comment","url":"https:\\/\\/callback.angry.space\\/vc_callback?date=2020&code=lMzBjOWZhOTM0ZDU1NTJiZjFlZmUy","filter":"[]","data":"[]","removed":false}],"data":{"type":"new_comment","data":{"id":3206086,"url":"https:\\/\\/vc.ru\\/trade\\/286961-wildberries-zapustil-dostavku-tovarov-za-2-chasa-v-peterburge?comment=3206086","text":"\\u042d\\u0442\\u043e \\u0442\\u043e\\u043b\\u044c\\u043a\\u043e \\u0441\\u043e \\u0441\\u0442\\u043e\\u0440\\u043e\\u043d\\u044b \\u0442\\u0430\\u043a \\u0432\\u0440\\u043e\\u0434\\u0435 \\u0434\\u043e\\u043b\\u0433\\u043e, \\u0430 \\u0435\\u0441\\u043b\\u0438 \\u0441\\u043c\\u043e\\u0442\\u0440\\u0435\\u0442\\u044c \\u0438\\u0437\\u043d\\u0443\\u0442\\u0440\\u0438, \\u0442\\u043e \\u043f\\u043e\\u043a\\u0430 \\u0442\\u0430\\u043c \\u043e\\u0441\\u0432\\u043e\\u0431\\u043e\\u0434\\u0438\\u0442\\u044c\\u0441\\u044f \\u043a\\u0443\\u043f\\u044c\\u0435\\u0440, \\u043f\\u043e\\u043a\\u0430 \\u043d\\u0430\\u0439\\u0434\\u0443\\u0442 \\u0442\\u043e\\u0432\\u0430\\u0440   \\u043f\\u043e\\u043a\\u0430 \\u0440\\u0430\\u0437\\u0431\\u0435\\u0440\\u0443\\u0442\\u044c\\u0441\\u044f \\u043a\\u0443\\u0434\\u0430 \\u0432\\u0435\\u0437\\u0442\\u0438 \\u043c\\u043e\\u0436\\u0435\\u0442 \\u0438 4 \\u0447\\u0430\\u0441\\u0430 \\u043f\\u0440\\u043e\\u0439\\u0442\\u0438.","media":[],"date":"2021-08-27T18:08:30+03:00","creator":{"id":27823,"avatar":"https:\\/\\/leonardo.osnova.io\\/8ddee2e8-28e4-7863-425e-dd9b06deae5d\\/","name":"Vitold S.","url":"https:\\/\\/vc.ru\\/u\\/27823-vitold-s"},"content":{"id":286961,"title":"Wildberries \\u0437\\u0430\\u043f\\u0443\\u0441\\u0442\\u0438\\u043b \\u0434\\u043e\\u0441\\u0442\\u0430\\u0432\\u043a\\u0443 \\u0442\\u043e\\u0432\\u0430\\u0440\\u043e\\u0432 \\u0437\\u0430 2 \\u0447\\u0430\\u0441\\u0430 \\u0432 \\u041f\\u0435\\u0442\\u0435\\u0440\\u0431\\u0443\\u0440\\u0433\\u0435","url":"https:\\/\\/vc.ru\\/trade\\/286961-wildberries-zapustil-dostavku-tovarov-za-2-chasa-v-peterburge","owner":{"id":199122,"name":"\\u0422\\u043e\\u0440\\u0433\\u043e\\u0432\\u043b\\u044f","avatar":"https:\\/\\/leonardo.osnova.io\\/d8fbb348-a8fd-641c-55dd-6a404055b457\\/","url":"https:\\/\\/vc.ru\\/trade"}},"reply_to":{"id":3205883,"url":"https:\\/\\/vc.ru\\/trade\\/286961-wildberries-zapustil-dostavku-tovarov-za-2-chasa-v-peterburge?comment=3205883","text":"\\u041d\\u0438\\u043a\\u0442\\u043e \\u043d\\u0435 \\u043f\\u043e\\u0448\\u0443\\u0442\\u0438\\u043b, \\u0442\\u043e\\u0433\\u0434\\u0430 \\u044d\\u0442\\u043e \\u0441\\u0434\\u0435\\u043b\\u0430\\u044e \\u044f!\\n\\n- 2.. \\u0447\\u0430\\u0441\\u0430!!1","media":[],"creator":{"id":877711,"avatar":"https:\\/\\/leonardo.osnova.io\\/476a4e2c-8045-5b77-8a37-f6b1eb58bf93\\/","name":"\\u0412\\u0430\\u0434\\u0438\\u043c \\u041e\\u0441\\u0430\\u0434\\u0447\\u0438\\u0439","url":"https:\\/\\/vc.ru\\/u\\/877711-vadim-osadchiy"}}}}}}',
          body_size: 2704,
          is_truncated: false,
          content_encoding: null,
          delivery_info: {
            channel: {
              callbacks: {
                'amq.ctag-_WgISNAcARc25tLbgtIIUg': [
                  {},
                  'handleMessage',
                ],
              },
            },
            delivery_tag: 291,
            redelivered: false,
            exchange: 'webhook_events_sender',
            routing_key: '',
            consumer_tag: 'amq.ctag-_WgISNAcARc25tLbgtIIUg',
          },
        },
      ],
    },
    {
      file: '/var/www/osnova/vendor/php-amqplib/php-amqplib/PhpAmqpLib/Channel/AbstractChannel.php',
      line: 220,
      function: 'call_user_func',
      args: [
        [
          {
            callbacks: {
              'amq.ctag-_WgISNAcARc25tLbgtIIUg': [
                {},
                'handleMessage',
              ],
            },
          },
          'basic_deliver',
        ],
        {},
        {
          body: '{"component":"Queue","method":{"Jobs":"sendWebhooksJob"},"parameters":{"watchers":[{"id":6697,"token":"539506","event":"new_comment","url":"https:\\/\\/callback.angry.space\\/vc_callback?date=2020&code=lMzBjOWZhOTM0ZDU1NTJiZjFlZmUy","filter":"[]","data":"[]","removed":false}],"data":{"type":"new_comment","data":{"id":3206086,"url":"https:\\/\\/vc.ru\\/trade\\/286961-wildberries-zapustil-dostavku-tovarov-za-2-chasa-v-peterburge?comment=3206086","text":"\\u042d\\u0442\\u043e \\u0442\\u043e\\u043b\\u044c\\u043a\\u043e \\u0441\\u043e \\u0441\\u0442\\u043e\\u0440\\u043e\\u043d\\u044b \\u0442\\u0430\\u043a \\u0432\\u0440\\u043e\\u0434\\u0435 \\u0434\\u043e\\u043b\\u0433\\u043e, \\u0430 \\u0435\\u0441\\u043b\\u0438 \\u0441\\u043c\\u043e\\u0442\\u0440\\u0435\\u0442\\u044c \\u0438\\u0437\\u043d\\u0443\\u0442\\u0440\\u0438, \\u0442\\u043e \\u043f\\u043e\\u043a\\u0430 \\u0442\\u0430\\u043c \\u043e\\u0441\\u0432\\u043e\\u0431\\u043e\\u0434\\u0438\\u0442\\u044c\\u0441\\u044f \\u043a\\u0443\\u043f\\u044c\\u0435\\u0440, \\u043f\\u043e\\u043a\\u0430 \\u043d\\u0430\\u0439\\u0434\\u0443\\u0442 \\u0442\\u043e\\u0432\\u0430\\u0440   \\u043f\\u043e\\u043a\\u0430 \\u0440\\u0430\\u0437\\u0431\\u0435\\u0440\\u0443\\u0442\\u044c\\u0441\\u044f \\u043a\\u0443\\u0434\\u0430 \\u0432\\u0435\\u0437\\u0442\\u0438 \\u043c\\u043e\\u0436\\u0435\\u0442 \\u0438 4 \\u0447\\u0430\\u0441\\u0430 \\u043f\\u0440\\u043e\\u0439\\u0442\\u0438.","media":[],"date":"2021-08-27T18:08:30+03:00","creator":{"id":27823,"avatar":"https:\\/\\/leonardo.osnova.io\\/8ddee2e8-28e4-7863-425e-dd9b06deae5d\\/","name":"Vitold S.","url":"https:\\/\\/vc.ru\\/u\\/27823-vitold-s"},"content":{"id":286961,"title":"Wildberries \\u0437\\u0430\\u043f\\u0443\\u0441\\u0442\\u0438\\u043b \\u0434\\u043e\\u0441\\u0442\\u0430\\u0432\\u043a\\u0443 \\u0442\\u043e\\u0432\\u0430\\u0440\\u043e\\u0432 \\u0437\\u0430 2 \\u0447\\u0430\\u0441\\u0430 \\u0432 \\u041f\\u0435\\u0442\\u0435\\u0440\\u0431\\u0443\\u0440\\u0433\\u0435","url":"https:\\/\\/vc.ru\\/trade\\/286961-wildberries-zapustil-dostavku-tovarov-za-2-chasa-v-peterburge","owner":{"id":199122,"name":"\\u0422\\u043e\\u0440\\u0433\\u043e\\u0432\\u043b\\u044f","avatar":"https:\\/\\/leonardo.osnova.io\\/d8fbb348-a8fd-641c-55dd-6a404055b457\\/","url":"https:\\/\\/vc.ru\\/trade"}},"reply_to":{"id":3205883,"url":"https:\\/\\/vc.ru\\/trade\\/286961-wildberries-zapustil-dostavku-tovarov-za-2-chasa-v-peterburge?comment=3205883","text":"\\u041d\\u0438\\u043a\\u0442\\u043e \\u043d\\u0435 \\u043f\\u043e\\u0448\\u0443\\u0442\\u0438\\u043b, \\u0442\\u043e\\u0433\\u0434\\u0430 \\u044d\\u0442\\u043e \\u0441\\u0434\\u0435\\u043b\\u0430\\u044e \\u044f!\\n\\n- 2.. \\u0447\\u0430\\u0441\\u0430!!1","media":[],"creator":{"id":877711,"avatar":"https:\\/\\/leonardo.osnova.io\\/476a4e2c-8045-5b77-8a37-f6b1eb58bf93\\/","name":"\\u0412\\u0430\\u0434\\u0438\\u043c \\u041e\\u0441\\u0430\\u0434\\u0447\\u0438\\u0439","url":"https:\\/\\/vc.ru\\/u\\/877711-vadim-osadchiy"}}}}}}',
          body_size: 2704,
          is_truncated: false,
          content_encoding: null,
          delivery_info: {
            channel: {
              callbacks: {
                'amq.ctag-_WgISNAcARc25tLbgtIIUg': [
                  {},
                  'handleMessage',
                ],
              },
            },
            delivery_tag: 291,
            redelivered: false,
            exchange: 'webhook_events_sender',
            routing_key: '',
            consumer_tag: 'amq.ctag-_WgISNAcARc25tLbgtIIUg',
          },
        },
      ],
    },
    {
      file: '/var/www/osnova/vendor/php-amqplib/php-amqplib/PhpAmqpLib/Channel/AbstractChannel.php',
      line: 374,
      function: 'dispatch',
      class: 'PhpAmqpLib\\Channel\\AbstractChannel',
      object: {
        callbacks: {
          'amq.ctag-_WgISNAcARc25tLbgtIIUg': [
            {},
            'handleMessage',
          ],
        },
      },
      type: '->',
      args: [
        '60,60',
        '\u001famq.ctag-_WgISNAcARc25tLbgtIIUg\u0000\u0000\u0000\u0000\u0000\u0000\u0001#\u0000\u0015webhook_events_sender\u0000',
        {
          body: '{"component":"Queue","method":{"Jobs":"sendWebhooksJob"},"parameters":{"watchers":[{"id":6697,"token":"539506","event":"new_comment","url":"https:\\/\\/callback.angry.space\\/vc_callback?date=2020&code=lMzBjOWZhOTM0ZDU1NTJiZjFlZmUy","filter":"[]","data":"[]","removed":false}],"data":{"type":"new_comment","data":{"id":3206086,"url":"https:\\/\\/vc.ru\\/trade\\/286961-wildberries-zapustil-dostavku-tovarov-za-2-chasa-v-peterburge?comment=3206086","text":"\\u042d\\u0442\\u043e \\u0442\\u043e\\u043b\\u044c\\u043a\\u043e \\u0441\\u043e \\u0441\\u0442\\u043e\\u0440\\u043e\\u043d\\u044b \\u0442\\u0430\\u043a \\u0432\\u0440\\u043e\\u0434\\u0435 \\u0434\\u043e\\u043b\\u0433\\u043e, \\u0430 \\u0435\\u0441\\u043b\\u0438 \\u0441\\u043c\\u043e\\u0442\\u0440\\u0435\\u0442\\u044c \\u0438\\u0437\\u043d\\u0443\\u0442\\u0440\\u0438, \\u0442\\u043e \\u043f\\u043e\\u043a\\u0430 \\u0442\\u0430\\u043c \\u043e\\u0441\\u0432\\u043e\\u0431\\u043e\\u0434\\u0438\\u0442\\u044c\\u0441\\u044f \\u043a\\u0443\\u043f\\u044c\\u0435\\u0440, \\u043f\\u043e\\u043a\\u0430 \\u043d\\u0430\\u0439\\u0434\\u0443\\u0442 \\u0442\\u043e\\u0432\\u0430\\u0440   \\u043f\\u043e\\u043a\\u0430 \\u0440\\u0430\\u0437\\u0431\\u0435\\u0440\\u0443\\u0442\\u044c\\u0441\\u044f \\u043a\\u0443\\u0434\\u0430 \\u0432\\u0435\\u0437\\u0442\\u0438 \\u043c\\u043e\\u0436\\u0435\\u0442 \\u0438 4 \\u0447\\u0430\\u0441\\u0430 \\u043f\\u0440\\u043e\\u0439\\u0442\\u0438.","media":[],"date":"2021-08-27T18:08:30+03:00","creator":{"id":27823,"avatar":"https:\\/\\/leonardo.osnova.io\\/8ddee2e8-28e4-7863-425e-dd9b06deae5d\\/","name":"Vitold S.","url":"https:\\/\\/vc.ru\\/u\\/27823-vitold-s"},"content":{"id":286961,"title":"Wildberries \\u0437\\u0430\\u043f\\u0443\\u0441\\u0442\\u0438\\u043b \\u0434\\u043e\\u0441\\u0442\\u0430\\u0432\\u043a\\u0443 \\u0442\\u043e\\u0432\\u0430\\u0440\\u043e\\u0432 \\u0437\\u0430 2 \\u0447\\u0430\\u0441\\u0430 \\u0432 \\u041f\\u0435\\u0442\\u0435\\u0440\\u0431\\u0443\\u0440\\u0433\\u0435","url":"https:\\/\\/vc.ru\\/trade\\/286961-wildberries-zapustil-dostavku-tovarov-za-2-chasa-v-peterburge","owner":{"id":199122,"name":"\\u0422\\u043e\\u0440\\u0433\\u043e\\u0432\\u043b\\u044f","avatar":"https:\\/\\/leonardo.osnova.io\\/d8fbb348-a8fd-641c-55dd-6a404055b457\\/","url":"https:\\/\\/vc.ru\\/trade"}},"reply_to":{"id":3205883,"url":"https:\\/\\/vc.ru\\/trade\\/286961-wildberries-zapustil-dostavku-tovarov-za-2-chasa-v-peterburge?comment=3205883","text":"\\u041d\\u0438\\u043a\\u0442\\u043e \\u043d\\u0435 \\u043f\\u043e\\u0448\\u0443\\u0442\\u0438\\u043b, \\u0442\\u043e\\u0433\\u0434\\u0430 \\u044d\\u0442\\u043e \\u0441\\u0434\\u0435\\u043b\\u0430\\u044e \\u044f!\\n\\n- 2.. \\u0447\\u0430\\u0441\\u0430!!1","media":[],"creator":{"id":877711,"avatar":"https:\\/\\/leonardo.osnova.io\\/476a4e2c-8045-5b77-8a37-f6b1eb58bf93\\/","name":"\\u0412\\u0430\\u0434\\u0438\\u043c \\u041e\\u0441\\u0430\\u0434\\u0447\\u0438\\u0439","url":"https:\\/\\/vc.ru\\/u\\/877711-vadim-osadchiy"}}}}}}',
          body_size: 2704,
          is_truncated: false,
          content_encoding: null,
          delivery_info: {
            channel: {
              callbacks: {
                'amq.ctag-_WgISNAcARc25tLbgtIIUg': [
                  {},
                  'handleMessage',
                ],
              },
            },
            delivery_tag: 291,
            redelivered: false,
            exchange: 'webhook_events_sender',
            routing_key: '',
            consumer_tag: 'amq.ctag-_WgISNAcARc25tLbgtIIUg',
          },
        },
      ],
    },
    {
      file: '/var/www/osnova/src/Osnova/RabbitMQ/Channel.php',
      line: 158,
      function: 'wait',
      class: 'PhpAmqpLib\\Channel\\AbstractChannel',
      object: {
        callbacks: {
          'amq.ctag-_WgISNAcARc25tLbgtIIUg': [
            {},
            'handleMessage',
          ],
        },
      },
      type: '->',
      args: [],
    },
    {
      file: '/var/www/osnova/src/Osnova/RabbitMQ/Worker.php',
      line: 79,
      function: 'wait',
      class: 'Osnova\\RabbitMQ\\Channel',
      object: {},
      type: '->',
      args: [],
    },
    {
      file: '/var/www/osnova/app/rabbitmq/consumers/webhookEventsSender.php',
      line: 30,
      function: 'start',
      class: 'Osnova\\RabbitMQ\\Worker',
      object: {},
      type: '->',
      args: [],
    },
  ],
};

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

  test('should return right object merge', () => {
    dataProvider.forEach((testCase) => {
      utils.deepDiff(testData.originalEvent, testData.eventToCompare);
    });
  });
});
