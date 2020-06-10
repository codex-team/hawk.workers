const _ = require('lodash');
const https = require('https');

/**
 * Stop execution for a given number of milliseconds
 *
 * @param {number} ms - number of milliseconds to stop execution
 * @returns {Promise<void>}
 */
module.exports.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Make `deepDiff` exportable
 * return {object}
 */
module.exports.deepDiff = deepDiff;

/**
 * Make `deepMerge` exportable
 * return {object}
 */
module.exports.deepMerge = deepMerge;

/**
 * Recursively scans two variables and returns another object with diffs
 *
 * @param {object|Array} source - source object
 * @param {object|Array} target - target object
 * @returns {object}
 */
function deepDiff(source, target) {
  if (typeOf(target) === 'array') {
    return arrayDiff(source, target);
  } else if (typeOf(target) === 'object') {
    return objectDiff(source, target);
  } else if (source !== target) {
    return target;
  } else {
    return source;
  }
}

/**
 * Returns two arrays difference as an new array
 *
 * @param {Array} source - source object
 * @param {Array} target - target object
 * @returns {Array}
 */
function arrayDiff(source, target) {
  const diffArray = [];

  for (let i = 0; i < target.length; i++) {
    diffArray[i] = deepDiff(source[i], target[i]);
  }

  return diffArray;
}

/**
 * Returns two objects difference as new object
 *
 * @param {object} objectA - first object for comparing
 * @param {object} objectB - second object for comparing
 *
 * @returns {object}
 */
function objectDiff(objectA, objectB) {
  const diffObject = {};

  /**
   * objectA is a subject,
   * we compare objectB patches
   *
   * For that we enumerate objectB props and assume that
   * target object has any changes
   *
   * But target object might have additional patches that might not be in subject
   * This corner case says us that whole property is a patch
   */
  if (!objectA) {
    return objectB;
  }

  Object.keys(objectB).forEach((prop) => {
    const objectAItem = objectA[prop];
    const objectBItem = objectB[prop];

    if (!objectAItem) {
      diffObject[prop] = objectBItem;

      return;
    }

    if (objectAItem === objectBItem) {
      return;
    }

    diffObject[prop] = deepDiff(objectAItem, objectBItem);
  });

  return diffObject;
}

/**
 * Merge to objects recursively
 *
 * @param {object} target - target object
 * @param {object[]} sources - sources for mering
 * @returns {object}
 */
function deepMerge(target, ...sources) {
  const isObject = (item) => item && typeOf(item) === 'object';

  return _.mergeWith({}, target, ...sources, function (_subject, _target) {
    if (_.isArray(_subject) && _.isArray(_target)) {
      const biggerArray = _subject.length > _target.length ? _subject : _target;
      const lesser = _subject.length > _target.length ? _target : _subject;

      return biggerArray.map((el, i) => {
        if (isObject(el) && isObject(lesser[i])) {
          return _.mergeWith({}, el, lesser[i]);
        } else {
          return el;
        }
      });
    }
  });
}

/**
 * Returns real type of passed variable
 *
 * @param {*} obj - value to check
 * @returns {string}
 */
function typeOf(obj) {
  return Object.prototype.toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
}

/**
 * Sends alert to the Slack/Telegram
 *
 * @param {string} text - message to send
 * @returns {Promise<void>}
 */
module.exports.sendReport = async function sendReport(text) {
  const message = `🦩 Hawk workers | ${text}`;
  const postData = 'parse_mode=Markdown&message=' + encodeURIComponent(message);
  const endpoint = process.env.CODEX_BOT_WEBHOOK;

  if (!endpoint) {
    return;
  }

  return new Promise((resolve) => {
    const request = https.request(endpoint, {
      method: 'POST',
      timeout: 3000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }, (response) => {
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        console.log('📤 Reporting:', chunk);

        resolve();
      });
    });

    request.on('error', (e) => {
      console.log('📤 Reporting failed:', e);

      /**
       * Does not throw error, so we don't need to catch it higher
       * and the application will not exit
       */
      resolve();
    });

    request.write(postData);
    request.end();
  });
};
