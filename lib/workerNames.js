/**
 * This file contains mapping of available workers to their Registry queue names
 *
 * 1. Get a list of available workers by a listing of /workers directory
 * 2. Map queue name got from the `workerType` property of worker's package.json file
 */
const fs = require('fs');
const path = require('path');
const workersDir = fs.readdirSync(path.resolve(__dirname, '..', 'workers'), { withFileTypes: true });

/**
 * @typedef {string} WorkerNameKey
 */

/**
 * @typedef {string} WorkerName
 */

/**
 * @type {Record<WorkerNameKey, WorkerName>}
 */
const workers = {};

workersDir.forEach(file => {
  if (!file.isDirectory()) {
    return;
  }

  const pkgPath = path.resolve(__dirname, '..', 'workers', file.name, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    return;
  }

  const pkg = require(pkgPath);

  workers[file.name.toUpperCase()] = pkg.workerType;
});

module.exports = workers;
