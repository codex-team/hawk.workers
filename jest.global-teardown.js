const process = require('process');

module.exports = () => {
  if (process.env.CI) {
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}