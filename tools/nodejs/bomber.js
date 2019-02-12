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
  .alias('h', 'help').argv;
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const EventEmitter = require('events');
var randomWords = require('random-words');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const Hawk = require('@codexteam/hawk.nodejs');

/**
 * Hawk catcher url
 */
const CATCHER_URL = process.env.CATCHER_URL || 'http://localhost:3000/';

/**
 * Hawk token
 */
const CATCHER_TOKEN = process.env.CATCHER_TOKEN || 'randomtoken';

/**
 * Errors type in randomize function
 * @type {number}
 */
const ERRORS_TYPE_COUNT = 10;

let errorEmitter = new EventEmitter();

const hawkCatcher = Hawk({
  url: CATCHER_URL,
  accessToken: CATCHER_TOKEN
});

class MyError extends Error {}

const main = async () => {
  function namedFunc() {
    try {
      let ind = Math.floor(Math.random() * ERRORS_TYPE_COUNT);

      switch (ind) {
        case 0: {
          // Simple Error
          throw new Error(getRandomText());
        }
        case 1: {
          throw new ReferenceError(getRandomText());
        }
        case 2: {
          // Range Error
          throw new RangeError(getRandomText());
        }
        case 3: {
          // Syntax Error
          /* eslint-disable-next-line */
          JSON.parse(getRandomText());
          break;
        }
        case 4: {
          // Type Error
          throw new TypeError(getRandomText());
        }
        case 5: {
          // Assertion Error
          let x = Math.random() * 1000;

          assert.strictEqual(1, x);
          break;
        }
        case 6: {
          // Error from EventEmitter
          errorEmitter.emit('error', new Error(getRandomText()));
          break;
        }
        case 7: {
          // System Error example: ENOENT
          fs.accessSync(getRandomText());
          break;
        }
        case 8: {
          // Custom Error
          throw new MyError(getRandomText());
        }
        case 9: {
          // Error from EventEmitter with custom Error
          errorEmitter.emit('error', new MyError(getRandomText()));
          break;
        }
      }
      return true;
    } catch (e) {
      hawkCatcher.catchException(
        e,
        { comment: 'Exception in namedFunc' },
        (error, response, body) => {
          if (error) {
            console.log('error:', error); // Print the error if one occurred
          }
          console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
          if (body) {
            console.log('body:', body); // Print the HTML for the Google homepage.
          }
        }
      );
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

function getRandomText() {
  return randomWords({min: 3, max: 10}).join(' ');
}

main();
