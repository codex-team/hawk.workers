#!/usr/bin/env node
/* eslint-disable require-jsdoc*/

/**
 * Generate token tool
 * Used to generate valid token for catcher for specific `projectId`
 * Convenient for testing purposes, e.g. setting token for bombers
 */

const argv = require('yargs')
  .usage('Usage: $0 projectId [secret]')
  .help('h')
  .alias('h', 'help').argv;

const { sign } = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || argv._[1] || 'qwerty';

const main = async () => {
  const projectId = argv._[0];

  console.log(sign({ projectId }, JWT_SECRET));
};

main();
