const fs = require('fs');
const path = require('path');

const workersDir = fs.readdirSync(__dirname + '/../workers', { withFileTypes: true });

const workers = {};

workersDir.forEach(file => {
  if (!file.isDirectory()) {
    return;
  }

  const pkgPath = path.resolve(__dirname, '..', 'workers', file.name, ' package.json');

  if (!fs.existsSync(pkgPath)) {
    return;
  }

  const pkg = require(pkgPath);

  workers[file.name.toUpperCase()] = pkg.workerType;
});

module.exports = workers;
