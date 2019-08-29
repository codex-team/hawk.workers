const _ = require('lodash');

/**
 * Stop execution for a given number of milliseconds
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
 * @param {object|array} source
 * @param {object|array} target
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
 * @param {array} source
 * @param {array} target
 *
 * @return {array}
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
 * @param {object} objectA
 * @param {object} objectB
 *
 * @return {object}
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
 * @param {object} target
 * @param {object[]} sources
 * @return {object}
 */
function deepMerge(target, ...sources) {
  const isObject = (item) => item && typeOf(item) === 'object';

  return _.mergeWith({}, target, ...sources, function(_subject, _target) {
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
 * @deprecated
 *
 * Merge to objects recursively
 * @param {object} target
 * @param {object[]} sources
 * @return {object}
 */
function _deepMerge(target, ...sources) {
  const isObject = (item) => item && typeOf(item) === 'object';

  if (!sources.length) {
    return target;
  }

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((prop) => {
      console.log('prop', prop);
      console.log('isObject(source[prop])', isObject(source[prop]));
      if (isObject(source[prop])) {
        if (!target[prop]) {
          Object.assign(target, { [prop]: {} });
        }

        deepMerge(target[prop], source[prop]);
      } else {
        Object.assign(target, { [prop]: source[prop] });
      }
    });
  }

  return deepMerge(target, ...sources);
}

/**
 * Returns real type of passed variable
 * @param obj
 * @return {string}
 */
function typeOf(obj) {
  return Object.prototype.toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
}
