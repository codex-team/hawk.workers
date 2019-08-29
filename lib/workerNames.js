const fs = require('fs');

const workersDir = fs.readdirSync(__dirname + '/../workers', { withFileTypes: true });

const workers = {};

workersDir.forEach(file => {
  if (!file.isDirectory()) {
    return;
  }

  const pkgPath = `${__dirname}/../workers/${file.name}/package.json`;

  if (!fs.existsSync(pkgPath)) {
    return;
  }

  const pkg = require(pkgPath);

  workers[file.name.toUpperCase()] = pkg.workerType;
});

module.exports = workers;
