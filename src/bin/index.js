#!/usr/bin/env node

import yargs from 'yargs';

process.on('unhandledRejection', (reason) => {
  throw reason;
});

process.on('uncaughtException', (error) => {
  throw error;
});

// eslint-disable-next-line no-unused-expressions
yargs
  .env('USUS')
  .commandDir('commands')
  .help()
  .wrap(80)
  .argv;
