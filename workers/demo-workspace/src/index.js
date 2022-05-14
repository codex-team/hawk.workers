const Socket = require('./socket')

const NUMBER_OF_ERRORS = Math.floor(Math.random() * 20) + 1;
const CONTEXT_STRINGS = [
  "We're no strangers to love",
  "You know the rules and so do I",
  "A full commitment's what I'm thinking of",
  "You wouldn't get this from any other guy",
  "I just wanna tell you how I'm feeling",
  "Gotta make you understand",
  "Never gonna give you up",
  "Never gonna let you down",
  "Never gonna run around and desert you",
  "Never gonna make you cry",
  "Never gonna say goodbye",
  "Never gonna tell a lie and hurt you",
  "We've known each other for so long",
  "Your heart's been aching, but you're too shy to say it",
  "Inside, we both know what's been going on",
  "We know the game, and we're gonna play it",
  "And if you ask me how I'm feeling",
  "Don't tell me you're too blind to see",
  "Never gonna give you up",
  "Never gonna let you down",
  "Never gonna run around and desert you",
  "Never gonna make you cry",
  "Never gonna say goodbye",
  "Never gonna tell a lie and hurt you",
  "Never gonna give you up",
  "Never gonna let you down",
  "Never gonna run around and desert you",
  "Never gonna make you cry",
  "Never gonna say goodbye",
  "Never gonna tell a lie and hurt you",
  "Ooh (Give you up)",
  "Ooh-ooh (Give you up)",
  "Ooh-ooh",
  "Never gonna give, never gonna give (Give you up)",
  "Ooh-ooh",
  "Never gonna give, never gonna give (Give you up)",
  "We've known each other for so long",
  "Your heart's been aching, but you're too shy to say it",
  "Inside, we both know what's been going on",
  "We know the game, and we're gonna play it",
  "I just wanna tell you how I'm feeling",
  "Gotta make you understand",
  "Never gonna give you up",
  "Never gonna let you down",
  "Never gonna run around and desert you",
  "Never gonna make you cry",
  "Never gonna say goodbye",
  "Never gonna tell a lie and hurt you",
  "Never gonna give you up",
  "Never gonna let you down",
  "Never gonna run around and desert you",
  "Never gonna make you cry",
  "Never gonna say goodbye",
  "Never gonna tell a lie and hurt you",
  "Never gonna give you up",
  "Never gonna let you down",
  "Never gonna run around and desert you",
  "Never gonna make you cry",
  "Never gonna say goodbye",
  "Never gonna tell a lie and hurt you"
];

const generateContext = () => {
  return CONTEXT_STRINGS[Math.floor(Math.random() * CONTEXT_STRINGS.length)];
}

const vueErrorFormatted = () => ({
  "token": "eyJpbnRlZ3JhdGlvbklkIjoiOWMzZjkxODQtZmI1ZS00MmJjLWE0Y2UtYzFlNjQwOWIzOTdhIiwic2VjcmV0IjoiYjE2MjU1MDAtY2IyYi00NjhlLWI2MzgtODViYzlmN2EwZTU0In0=",
  "catcherType": "errors/javascript",
  "payload": {
    "title": "foo is not defined",
    "type": "ReferenceError",
    "release": null,
    "context": {
      "rootContextSample": generateContext(),
    },
    "user": {
      "id": "FmDjGOx9fDZJtfQp073qCuRxpkWMIpaGMMUJedxT"
    },
    "addons": {
      "window": {
        "innerWidth": 874,
        "innerHeight": 799
      },
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.119 YaBrowser/22.3.0.2520 Yowser/2.5 Safari/537.36",
      "url": "file:///Users/demo-workspace/example/index.html",
      "vue": {
        "lifecycle": "v-on handler",
        "component": "<div id=\"vue-app-1\"> (root)",
        "data": {
          "label": "Error in Vue $root"
        }
      }
    },
    "backtrace": [
      {
        "file": "file:///Users/demo-workspace/example/index.html",
        "line": 172,
        "column": 13,
        "sourceCode": null,
        "function": "Vue.buttonClicked"
      },
      {
        "file": "https://unpkg.com/vue@2",
        "line": 1872,
        "column": 28,
        "sourceCode": [
          {
            "line": 1867,
            "content": "    vm,"
          },
          {
            "line": 1868,
            "content": "    info"
          },
          {
            "line": 1869,
            "content": "  ) {"
          },
          {
            "line": 1870,
            "content": "    var res;"
          },
          {
            "line": 1871,
            "content": "    try {"
          },
          {
            "line": 1872,
            "content": "      res = args ? handler.apply(context, args) : handler.call(context);"
          },
          {
            "line": 1873,
            "content": "      if (res && !res._isVue && isPromise(res) && !res._handled) {"
          },
          {
            "line": 1874,
            "content": "        res.catch(function (e) { return handleError(e, vm, info + \" (Promise/async)\"); });"
          },
          {
            "line": 1875,
            "content": "        // issue #9511"
          },
          {
            "line": 1876,
            "content": "        // avoid catch triggering multiple times when nested calls"
          },
          {
            "line": 1877,
            "content": "        res._handled = true;"
          }
        ],
        "function": "invokeWithErrorHandling"
      },
      {
        "file": "https://unpkg.com/vue@2",
        "line": 2197,
        "column": 16,
        "sourceCode": [
          {
            "line": 2192,
            "content": "        for (var i = 0; i < cloned.length; i++) {"
          },
          {
            "line": 2193,
            "content": "          invokeWithErrorHandling(cloned[i], null, arguments$1, vm, \"v-on handler\");"
          },
          {
            "line": 2194,
            "content": "        }"
          },
          {
            "line": 2195,
            "content": "      } else {"
          },
          {
            "line": 2196,
            "content": "        // return handler return value for single handlers"
          },
          {
            "line": 2197,
            "content": "        return invokeWithErrorHandling(fns, null, arguments, vm, \"v-on handler\")"
          },
          {
            "line": 2198,
            "content": "      }"
          },
          {
            "line": 2199,
            "content": "    }"
          },
          {
            "line": 2200,
            "content": "    invoker.fns = fns;"
          },
          {
            "line": 2201,
            "content": "    return invoker"
          },
          {
            "line": 2202,
            "content": "  }"
          }
        ],
        "function": "HTMLButtonElement.invoker"
      },
      {
        "file": "https://unpkg.com/vue@2",
        "line": 7591,
        "column": 27,
        "sourceCode": [
          {
            "line": 7586,
            "content": "          // #9448 bail if event is fired in another document in a multi-page"
          },
          {
            "line": 7587,
            "content": "          // electron/nw.js app, since event.timeStamp will be using a different"
          },
          {
            "line": 7588,
            "content": "          // starting reference"
          },
          {
            "line": 7589,
            "content": "          e.target.ownerDocument !== document"
          },
          {
            "line": 7590,
            "content": "        ) {"
          },
          {
            "line": 7591,
            "content": "          return original.apply(this, arguments)"
          },
          {
            "line": 7592,
            "content": "        }"
          },
          {
            "line": 7593,
            "content": "      };"
          },
          {
            "line": 7594,
            "content": "    }"
          },
          {
            "line": 7595,
            "content": "    target$1.addEventListener("
          },
          {
            "line": 7596,
            "content": "      name,"
          }
        ],
        "function": "HTMLButtonElement.original._wrapper"
      }
    ]
  }
})

const getIntegrationId = () => {
  try {
    
    const decode = (str) => Buffer.from(str, 'base64').toString('binary');
    const decodedIntegrationToken = JSON.parse(decode('eyJpbnRlZ3JhdGlvbklkIjoiOGRkY2Y5ZWUtMDk0MS00NmE2LWFmNzctOTY5MDEwNTZlYzQ3Iiwic2VjcmV0IjoiNmExNDc4MGQtMDI2Mi00OTYyLTkzMDYtZmQ4ZDk1ODY5Y2RiIn0='));
    const { integrationId } = decodedIntegrationToken;

    if (!integrationId || integrationId === '') {
      throw new Error();
    }

    return integrationId;
  } catch {
    throw new Error('Invalid integration token.');
  }
}  




let transport = new Socket({
  collectorEndpoint: `wss://${getIntegrationId()}.k1.hawk.so:443/ws`,
  reconnectionAttempts: 1,
  reconnectionTimeout: 5000,
  onClose() {
    console.log(
      'Connection lost. Connection will be restored when new errors occurred',
      'info'
    );  
  },  
});  


const requests = [];

for (let i = 0; i < NUMBER_OF_ERRORS; i++) {
  const errorFormatted = vueErrorFormatted();

  requests.push(transport.send(errorFormatted)
    .then(() => {
      console.log('Successfully sended', i)
    })
    .catch((sendingError) => {
      console.log('WebSocket sending error', 'error', sendingError);
    })  
  );  
}  

const sleep = async (ms) => {
  await new Promise(r => setTimeout(r, ms));
}

async function main() {
  sleep(100000);

  Promise.allSettled(requests).then(() => {
    process.exit(1);
  });  
}

main();

