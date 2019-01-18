#!/usr/bin/env node

/**
 * Error bomber for nodejs hawk catcher
 */

/* eslint-disable require-jsdoc*/
var argv = require('yargs')
  .usage('Usage: $0 <command> [options]')
  .command('once', 'send error once')
  .example('$0 once', 'send error once and exit')
  .command('interval [seconds]', 'send errors every interval time')
  .example('$0 interval 5', 'send error every 5 seconds')
  .demandCommand(1, 'You need at least one command before moving on')
  .help('h')
  .alias('h', 'help')
  .argv;
const path = require('path');

require('dotenv').config({path: path.resolve(__dirname, '.env')});
const Hawk = require('@codexteam/hawk.nodejs');

/**
 * Hawk catcher url
 */
const CATCHER_URL = process.env.CATCHER_URL || 'http://localhost:3000/catcher';

/**
 * Hawk token
 */
const CATCHER_TOKEN = process.env.CATCHER_TOKEN || 'randomtoken';

const hawkCatcher = Hawk({
  url: CATCHER_URL,
  accessToken: CATCHER_TOKEN
});

const main = async () => {
  function namedFunc() {
    try {
      console.log('Named func');
      /* eslint-disable-next-line */
      kek();
      return true;
    } catch (e) {
      hawkCatcher.catchException(e, {comment: 'Exception in namedFunc'}, (error, response, body) => {
        if (error) {
          console.log('error:', error); // Print the error if one occurred
        }
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
        if (body) {
          console.log('body:', body); // Print the HTML for the Google homepage.
        }
      });
    }
  }

  const command = argv._[0];

  if (command === 'once') {
    namedFunc();
  } else if (command === 'interval') {
    if (argv.seconds) {
      const interval = parseInt(argv.seconds * 1000);

      setInterval(namedFunc, interval);
    }
  }
};

main();