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

  for (const field in objectB) {
    // eslint-disable-next-line no-prototype-builtins
    if (!objectB.hasOwnProperty(field)) {
      continue;
    }

    const objectAItem = objectA[field];
    const objectBItem = objectB[field];

    if (!objectAItem) {
      diffObject[field] = objectBItem;
      return;
    }

    if (objectAItem === objectBItem) {
      continue;
    }

    diffObject[field] = deepDiff(objectAItem, objectBItem);
  }

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

  if (!sources.length) {
    return target;
  }

  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      // eslint-disable-next-line no-prototype-builtins
      if (!source.hasOwnProperty(key)) {
        continue;
      }

      if (isObject(source[key])) {
        if (!target[key]) {
          Object.assign(target, { [key]: {} });
        }

        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
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
