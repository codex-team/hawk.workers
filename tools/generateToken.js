#!/usr/bin/env node

/**
 * Generate token tool
 */

/* eslint-disable require-jsdoc*/
let argv = require('yargs')
  .usage('Usage: $0 projectId')
  .help('h')
  .alias('h', 'help').argv;

const { sign } = require('jsonwebtoken');

const main = async () => {
  const projectId = argv._[0];

  console.log(sign({ projectId }, 'qwerty'));
};

main();
